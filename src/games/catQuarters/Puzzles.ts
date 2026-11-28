export const PUZZLES = [
  { name: 'Sunny Sill', rows: ['ABBBB', 'DDBCC', 'DDBCC', 'DDEEE', 'DDDEE'] },
  { name: 'Quiet Nook', rows: ['BBAAB', 'BBBBB', 'BBBBC', 'DCCCC', 'EEEEC'] },
  { name: 'Fern Room', rows: ['DAABBB', 'DDABBB', 'DDCCBB', 'DDDEEE', 'FDDEEE', 'FDDEEE'] },
  { name: 'Attic Steps', rows: ['BBAAAA', 'BBBAAC', 'BBEEAC', 'DDEEEE', 'FDEEEE', 'FDEEEE'] },
  { name: 'Moon Porch', rows: ['AAAAAAB', 'AAACCBB', 'AAACCBD', 'CCCCBBD', 'ECCFFFF', 'EGFFFFF', 'EGFFFFF'] },
  { name: 'Rooftop Roost', rows: ['AABCCCC', 'BBBBCCC', 'EEECCCC', 'EEEECCD', 'EEECCFD', 'EEEGGFF', 'EEEGGGG'] },
];

/** Generated boards can be this many tiles wide. */
export const MIN_SIZE = 5;
export const MAX_SIZE = 10;
export const DEFAULT_SIZE = 7;

/** Room letters in reading order, one per room. */
export const ROOM_LETTERS = 'ABCDEFGHIJ';

export function isPuzzleSize(size: unknown): size is number {
  return typeof size === 'number' && Number.isInteger(size) && size >= MIN_SIZE && size <= MAX_SIZE;
}

export function puzzleKey(rows: readonly string[]): string {
  const rooms = new Map<string, string>();
  return Array.from(rows.join(''), room => {
    if (!rooms.has(room)) rooms.set(room, ROOM_LETTERS[rooms.size]);
    return rooms.get(room);
  }).join('');
}

/** A square board, MIN_SIZE to MAX_SIZE tiles wide, using exactly that many rooms lettered from A. */
export function isGeneratedBoard(rows: unknown): rows is string[] {
  if (!Array.isArray(rows)) return false;
  const size = rows.length;
  if (!isPuzzleSize(size)) return false;
  const letters = ROOM_LETTERS.slice(0, size);
  if (!rows.every(row => typeof row === 'string' && row.length === size
    && Array.from(row).every(room => letters.includes(room)))) return false;
  return new Set(rows.join('')).size === size;
}

export function findConflicts(regions: string, size: number, cats: readonly number[]): Set<number> {
  const conflicts = new Set<number>();
  cats.forEach((first, index) => {
    const row = Math.floor(first / size);
    const col = first % size;
    for (const second of cats.slice(index + 1)) {
      const rowDistance = Math.abs(row - Math.floor(second / size));
      const colDistance = Math.abs(col - (second % size));
      if (!rowDistance || !colDistance || regions[first] === regions[second]
        || (rowDistance === 1 && colDistance === 1)) {
        conflicts.add(first);
        conflicts.add(second);
      }
    }
  });
  return conflicts;
}
