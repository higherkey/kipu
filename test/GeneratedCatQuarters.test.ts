import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/api/cat-quarters/puzzle';
import { countSolutions, generatePuzzle, roomBounds } from '../src/games/catQuarters/generatePuzzle';
import { findConflicts, isGeneratedBoard, MAX_SIZE, MIN_SIZE, puzzleKey } from '../src/games/catQuarters/Puzzles';

// Independent of the generator's own solver: tries every column in every row.
function countByBruteForce(rows: string[]): number {
  const size = rows.length;
  const regions = rows.join('');
  function search(cats: number[]): number {
    if (cats.length === size) return 1;
    let count = 0;
    for (let column = 0; column < size && count < 2; column++) {
      const next = [...cats, cats.length * size + column];
      if (findConflicts(regions, size, next).size === 0) count += search(next);
    }
    return count;
  }
  return search([]);
}

function roomSizes(rows: string[]): Map<string, number[]> {
  const rooms = new Map<string, number[]>();
  Array.from(rows.join('')).forEach((room, index) => rooms.set(room, [...(rooms.get(room) ?? []), index]));
  return rooms;
}

function isConnected(tiles: number[], size: number): boolean {
  const connected = new Set([tiles[0]]);
  for (const tile of connected) {
    for (const neighbor of tiles) {
      if (Math.abs(Math.floor(tile / size) - Math.floor(neighbor / size))
        + Math.abs(tile % size - neighbor % size) === 1) connected.add(neighbor);
    }
  }
  return connected.size === tiles.length;
}

function seededRandom(seed = 701) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('generated Cat Quarters puzzles', () => {
  const sizes = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, index) => MIN_SIZE + index);

  it.each(sizes)('builds varied %i × %i boards with one solution and bounded rooms', size => {
    const random = seededRandom(size * 101);
    const { min, max } = roomBounds(size);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const rows = generatePuzzle(size, random)!;
      expect(rows).toHaveLength(size);
      expect(isGeneratedBoard(rows)).toBe(true);
      expect(countByBruteForce(rows)).toBe(1);
      for (const tiles of roomSizes(rows).values()) {
        expect(tiles.length).toBeGreaterThanOrEqual(min);
        expect(tiles.length).toBeLessThanOrEqual(max);
        expect(isConnected(tiles, size)).toBe(true);
      }
      seen.add(puzzleKey(rows));
    }
    expect(seen.size).toBe(4);
  }, 60_000);

  it('caps rooms well below the old giant rooms', () => {
    expect(roomBounds(7)).toEqual({ min: 3, max: 12 });
    expect(roomBounds(10)).toEqual({ min: 3, max: 16 });
    expect(roomBounds(5).min).toBe(2);
  });

  it('agrees with brute force on solution counts', () => {
    const rows = ['ABBBB', 'DDBCC', 'DDBCC', 'DDEEE', 'DDDEE'];
    const rooms = Array.from(rows.join(''), room => room.charCodeAt(0) - 65);
    expect(countSolutions(5, rooms)).toBe(countByBruteForce(rows));
    // Rooms that are just the columns: every non-touching arrangement counts (14 of them on 5 × 5).
    expect(countSolutions(5, Array.from({ length: 25 }, (_, i) => i % 5), 20)).toBe(14);
  });

  it('rejects sizes outside the range', () => {
    expect(() => generatePuzzle(MIN_SIZE - 1)).toThrow(RangeError);
    expect(() => generatePuzzle(MAX_SIZE + 1)).toThrow(RangeError);
    expect(isGeneratedBoard(['ABCD', 'ABCD', 'ABCD', 'ABCD'])).toBe(false);
  });
});

describe('Cat Quarters puzzle API', () => {
  const url = 'http://localhost/api/cat-quarters/puzzle';

  function get(query = '') {
    const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom());
    try {
      return onRequest({ request: new Request(url + query) });
    } finally {
      random.mockRestore();
    }
  }

  it('returns a 7 × 7 board by default and the size asked for', async () => {
    const result = get();
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    const payload = await result.json();
    expect(Object.keys(payload)).toEqual(['rows']);
    expect(payload.rows).toHaveLength(7);
    expect(isGeneratedBoard(payload.rows)).toBe(true);

    const nine = await get('?size=9').json();
    expect(nine.rows).toHaveLength(9);
    expect(isGeneratedBoard(nine.rows)).toBe(true);
  }, 30_000);

  it('rejects bad sizes and unsupported methods', () => {
    for (const size of ['4', '11', '7.5', 'big']) expect(get(`?size=${size}`).status).toBe(400);
    const invalid = onRequest({ request: new Request(url, { method: 'POST' }) });
    expect(invalid.status).toBe(405);
    expect(invalid.headers.get('allow')).toBe('GET');
    expect(invalid.headers.get('content-type')).toBe('application/problem+json');
  });
});
