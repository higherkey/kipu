export const SIZE = 6;
export const TREATS = ['Fish', 'Berry', 'Biscuit', 'Leaf', 'Yarn'] as const;
export const LEVELS = [
  { name: 'Breakfast Bowl', seed: 83, moves: 20, goals: [[0, 12]] },
  { name: 'Porch Picnic', seed: 211, moves: 20, goals: [[1, 14], [3, 12]] },
  { name: 'Biscuit Bakery', seed: 647, moves: 18, goals: [[2, 16], [4, 14]] },
  { name: 'Garden Party', seed: 901, moves: 18, goals: [[0, 14], [1, 14], [3, 14]] },
] as const;

type Swap = [number, number];
type Run = { cells: number[]; step: number };
export type Wave = { board: number[]; cleared: Set<number> };

export function seededRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function neighbor(index: number, row: number, column: number): number {
  const y = Math.floor(index / SIZE) + row;
  const x = index % SIZE + column;
  return y >= 0 && y < SIZE && x >= 0 && x < SIZE ? y * SIZE + x : -1;
}

function runs(board: number[]): Run[] {
  const matches: Run[] = [];
  for (const step of [1, SIZE]) {
    for (let line = 0; line < SIZE; line++) {
      const start = step === 1 ? line * SIZE : line;
      let first = 0;
      for (let end = 1; end <= SIZE; end++) {
        if (end < SIZE && board[start + end * step] === board[start + first * step]) continue;
        if (end - first >= 3) {
          matches.push({ step, cells: Array.from({ length: end - first }, (_, i) => start + (first + i) * step) });
        }
        first = end;
      }
    }
  }
  return matches;
}

function swap(board: number[], a: number, b: number): number[] {
  const next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function hint(board: number[]): Swap | undefined {
  for (let i = 0; i < board.length; i++) {
    for (const j of [neighbor(i, 0, 1), neighbor(i, 1, 0)]) {
      if (j >= 0 && board[i] !== board[j] && runs(swap(board, i, j)).length) return [i, j];
    }
  }
}

export function makeBoard(random: () => number): number[] {
  const board: number[] = [];
  do {
    board.length = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const blocked = new Set<number>();
      if (i % SIZE >= 2 && board[i - 1] === board[i - 2]) blocked.add(board[i - 1]);
      if (i >= SIZE * 2 && board[i - SIZE] === board[i - SIZE * 2]) blocked.add(board[i - SIZE]);
      const choices = TREATS.map((_, id) => id).filter(id => !blocked.has(id));
      board.push(choices[Math.floor(random() * choices.length)]);
    }
  } while (!hint(board));
  return board;
}

export function playSwap(board: number[], a: number, b: number, random: () => number) {
  if (a < 0 || a >= board.length || b < 0 || b >= board.length || board[a] === board[b]) return;
  if (![neighbor(a, 0, 1), neighbor(a, 0, -1), neighbor(a, 1, 0), neighbor(a, -1, 0)].includes(b)) return;

  let next = swap(board, a, b);
  const waves: Wave[] = [];
  const collected = TREATS.map(() => 0);
  let matches = runs(next);
  while (matches.length) {
    const cleared = new Set(matches.flatMap(run => run.cells));
    for (const { cells, step } of matches) {
      if (cells.length < 4) continue;
      const pivot = cells[Math.floor(cells.length / 2)];
      for (let i = 0; i < SIZE; i++) {
        if (step === 1 || cells.length >= 5) cleared.add(Math.floor(pivot / SIZE) * SIZE + i);
        if (step === SIZE || cells.length >= 5) cleared.add(pivot % SIZE + i * SIZE);
      }
    }
    for (const index of cleared) collected[next[index]]++;
    waves.push({ board: next, cleared });

    const fallen: number[] = [];
    for (let x = 0; x < SIZE; x++) {
      let write = SIZE - 1;
      for (let y = SIZE - 1; y >= 0; y--) {
        const index = y * SIZE + x;
        if (!cleared.has(index)) fallen[write-- * SIZE + x] = next[index];
      }
      while (write >= 0) fallen[write-- * SIZE + x] = Math.floor(random() * TREATS.length);
    }
    next = fallen;
    matches = runs(next);
  }

  if (!waves.length) return;
  const shuffled = !hint(next);
  return { board: shuffled ? makeBoard(random) : next, waves, collected, shuffled };
}
