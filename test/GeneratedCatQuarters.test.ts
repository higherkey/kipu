import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/api/cat-quarters/puzzle';
import { generatePuzzle } from '../server/catQuarters/generatePuzzle';
import { findConflicts, isGeneratedBoard, puzzleKey } from '../src/games/catQuarters/Puzzles';

function countSolutions(rows: string[]): number {
  const size = rows.length;
  const regions = rows.join('');
  function search(cats: number[]): number {
    if (cats.length === size) return 1;
    let count = 0;
    for (let column = 0; column < size; column++) {
      const next = [...cats, cats.length * size + column];
      if (findConflicts(regions, size, next).size === 0) count += search(next);
    }
    return count;
  }
  return search([]);
}

function seededRandom() {
  let seed = 701;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('server-generated Cat Quarters puzzles', () => {
  it('produces varied, connected boards with one solution each', () => {
    const random = seededRandom();
    const seen = new Set<string>();

    for (let i = 0; i < 30; i++) {
      const rows = generatePuzzle(random)!;
      expect(isGeneratedBoard(rows)).toBe(true);
      expect(countSolutions(rows)).toBe(1);
      const size = rows.length;
      const regions = rows.join('');
      for (const room of new Set(regions)) {
        const tiles = Array.from(regions, (letter, index) => letter === room ? index : -1)
          .filter(index => index >= 0);
        const connected = new Set([tiles[0]]);
        for (const tile of connected) {
          for (const neighbor of tiles) {
            if (Math.abs(Math.floor(tile / size) - Math.floor(neighbor / size))
              + Math.abs(tile % size - neighbor % size) === 1) connected.add(neighbor);
          }
        }
        expect(connected.size).toBe(tiles.length);
      }
      seen.add(puzzleKey(rows));
    }
    expect(seen.size).toBe(30);
  });

  it('returns a board over GET and rejects unsupported methods', async () => {
    const url = 'http://localhost/api/cat-quarters/puzzle';
    const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom());
    let result: Response;
    try {
      result = onRequest({ request: new Request(url) });
    } finally {
      random.mockRestore();
    }
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    const payload = await result.json();
    expect(Object.keys(payload)).toEqual(['rows']);
    expect(isGeneratedBoard(payload.rows)).toBe(true);

    const invalid = onRequest({ request: new Request(url, { method: 'POST' }) });
    expect(invalid.status).toBe(405);
    expect(invalid.headers.get('allow')).toBe('GET');
    expect(invalid.headers.get('content-type')).toBe('application/problem+json');
  });
});
