export const PUZZLES = [
  { name: 'Sunny Sill', rows: ['ABBBB', 'DDBCC', 'DDBCC', 'DDEEE', 'DDDEE'] },
  { name: 'Quiet Nook', rows: ['BBAAB', 'BBBBB', 'BBBBC', 'DCCCC', 'EEEEC'] },
  { name: 'Fern Room', rows: ['DAABBB', 'DDABBB', 'DDCCBB', 'DDDEEE', 'FDDEEE', 'FDDEEE'] },
  { name: 'Attic Steps', rows: ['BBAAAA', 'BBBAAC', 'BBEEAC', 'DDEEEE', 'FDEEEE', 'FDEEEE'] },
  { name: 'Moon Porch', rows: ['AAAAAAB', 'AAACCBB', 'AAACCBD', 'CCCCBBD', 'ECCFFFF', 'EGFFFFF', 'EGFFFFF'] },
  { name: 'Rooftop Roost', rows: ['AABCCCC', 'BBBBCCC', 'EEECCCC', 'EEEECCD', 'EEECCFD', 'EEEGGFF', 'EEEGGGG'] },
];

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
