import { GENERATED_ROOMS, GENERATED_SIZE, puzzleKey } from '../../src/games/catQuarters/Puzzles';

const SIZE = GENERATED_SIZE;
const CELL_COUNT = SIZE * SIZE;
const ALL_ROOMS = (1 << SIZE) - 1;
const NEIGHBORS = Array.from({ length: CELL_COUNT }, (_, index) => [
  index >= SIZE ? index - SIZE : -1,
  index < CELL_COUNT - SIZE ? index + SIZE : -1,
  index % SIZE > 0 ? index - 1 : -1,
  index % SIZE < SIZE - 1 ? index + 1 : -1,
].filter(cell => cell >= 0));

// Enumerate every arrangement that already satisfies rows, columns, and touching.
const PLACEMENTS: number[][] = [];
function enumeratePlacements(cats: number[], columns: number, previousColumn: number): void {
  if (cats.length === SIZE) {
    PLACEMENTS.push(cats);
    return;
  }
  for (let col = 0; col < SIZE; col++) {
    const flag = 1 << col;
    if (!(columns & flag) && Math.abs(col - previousColumn) > 1) {
      enumeratePlacements([...cats, cats.length * SIZE + col], columns | flag, col);
    }
  }
}
enumeratePlacements([], 0, -2);

function hasUniqueSolution(board: Int8Array): boolean {
  let solutions = 0;
  for (const cats of PLACEMENTS) {
    let rooms = 0;
    for (const tile of cats) {
      const room = 1 << board[tile];
      if (rooms & room) break;
      rooms |= room;
    }
    if (rooms === ALL_ROOMS && ++solutions > 1) return false;
  }
  return solutions === 1;
}

export function generatePuzzle(random = Math.random): string[] | undefined {
  const pick = (length: number) => Math.floor(random() * length);
  // Keep the work per request bounded. A fresh attempt is inexpensive if this budget runs out.
  for (let attempt = 0; attempt < 128; attempt++) {
    const board = new Int8Array(CELL_COUNT).fill(-1);
    const cats = PLACEMENTS[pick(PLACEMENTS.length)];
    const firstSmallRoom = pick(SIZE);
    const secondSmallRoom = (firstSmallRoom + 1 + pick(SIZE - 1)) % SIZE;
    const frontier: { tile: number; room: number }[] = [];
    let filled = 0;

    function place(tile: number, room: number): void {
      board[tile] = room;
      filled++;
      if (room === firstSmallRoom || room === secondSmallRoom) return;
      for (const neighbor of NEIGHBORS[tile]) {
        if (board[neighbor] < 0) frontier.push({ tile: neighbor, room });
      }
    }

    cats.forEach(place);
    while (frontier.length) {
      const index = pick(frontier.length);
      const { tile, room } = frontier[index];
      frontier[index] = frontier[frontier.length - 1];
      frontier.pop();
      if (board[tile] < 0) place(tile, room);
    }

    if (filled === CELL_COUNT && hasUniqueSolution(board)) {
      const cells = puzzleKey([Array.from(board, room => GENERATED_ROOMS[room]).join('')]);
      return Array.from({ length: SIZE }, (_, row) => cells.slice(row * SIZE, (row + 1) * SIZE));
    }
  }
  return undefined;
}
