export const PUZZLES = [
  { name: 'Sunny Sill', rows: ['ABBBB', 'DDBCC', 'DDBCC', 'DDEEE', 'DDDEE'] },
  { name: 'Quiet Nook', rows: ['BBAAB', 'BBBBB', 'BBBBC', 'DCCCC', 'EEEEC'] },
  { name: 'Fern Room', rows: ['DAABBB', 'DDABBB', 'DDCCBB', 'DDDEEE', 'FDDEEE', 'FDDEEE'] },
  { name: 'Attic Steps', rows: ['BBAAAA', 'BBBAAC', 'BBEEAC', 'DDEEEE', 'FDEEEE', 'FDEEEE'] },
  { name: 'Moon Porch', rows: ['AAAAAAB', 'AAACCBB', 'AAACCBD', 'CCCCBBD', 'ECCFFFF', 'EGFFFFF', 'EGFFFFF'] },
  { name: 'Rooftop Roost', rows: ['AABCCCC', 'BBBBCCC', 'EEECCCC', 'EEEECCD', 'EEECCFD', 'EEEGGFF', 'EEEGGGG'] },
];

export const GENERATED_SIZE = 7;
export const GENERATED_ROOMS = 'ABCDEFG';

export function puzzleKey(rows: readonly string[]): string {
  const rooms = new Map<string, string>();
  return Array.from(rows.join(''), room => {
    if (!rooms.has(room)) rooms.set(room, GENERATED_ROOMS[rooms.size]);
    return rooms.get(room);
  }).join('');
}

export function isGeneratedBoard(rows: unknown): rows is string[] {
  return Array.isArray(rows) && rows.length === GENERATED_SIZE
    && Array.from(rows).every(row => typeof row === 'string' && /^[A-G]{7}$/.test(row))
    && new Set(rows.join('')).size === GENERATED_SIZE;
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
