import { DEFAULT_SIZE, isPuzzleSize, MAX_SIZE, MIN_SIZE, ROOM_LETTERS } from './Puzzles';

/**
 * Smallest and largest room a generated board may have. Tiny rooms give their cat away and
 * huge rooms leave nothing to work out, so both scale with the board.
 */
export function roomBounds(size: number): { min: number; max: number } {
  return { min: size <= 5 ? 2 : 3, max: Math.ceil(size * 1.6) };
}

type Random = () => number;

function neighborsOf(size: number): number[][] {
  return Array.from({ length: size * size }, (_, tile) => {
    const row = Math.floor(tile / size);
    const col = tile % size;
    const out: number[] = [];
    if (row > 0) out.push(tile - size);
    if (row < size - 1) out.push(tile + size);
    if (col > 0) out.push(tile - 1);
    if (col < size - 1) out.push(tile + 1);
    return out;
  });
}

/**
 * Finds up to `limit` solutions. Places one cat at a time in the row, column or room with the
 * fewest open tiles, then rules out its row, column, room and the eight tiles around it.
 */
export function findSolutions(size: number, rooms: ArrayLike<number>, limit = 2): number[][] {
  const cells = size * size;
  const units: number[][] = [];
  for (let row = 0; row < size; row++) units.push(Array.from({ length: size }, (_, col) => row * size + col));
  for (let col = 0; col < size; col++) units.push(Array.from({ length: size }, (_, row) => row * size + col));
  for (let room = 0; room < size; room++) units.push([]);
  for (let tile = 0; tile < cells; tile++) units[2 * size + rooms[tile]].push(tile);
  const filled = new Uint8Array(3 * size);
  const found: number[][] = [];
  const picked: number[] = [];

  function search(open: Uint8Array): void {
    if (picked.length === size) {
      found.push([...picked]);
      return;
    }
    let best = -1;
    let fewest = Infinity;
    for (let unit = 0; unit < 3 * size && fewest > 1; unit++) {
      if (filled[unit]) continue;
      let count = 0;
      for (const tile of units[unit]) count += open[tile];
      if (count < fewest) {
        fewest = count;
        best = unit;
      }
    }
    if (fewest === 0) return;
    for (const tile of units[best]) {
      if (!open[tile]) continue;
      const row = Math.floor(tile / size);
      const col = tile % size;
      const room = 2 * size + rooms[tile];
      const next = open.slice();
      for (const other of units[row]) next[other] = 0;
      for (const other of units[size + col]) next[other] = 0;
      for (const other of units[room]) next[other] = 0;
      for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, col + 1); c++) next[r * size + c] = 0;
      }
      filled[row] = filled[size + col] = filled[room] = 1;
      picked.push(tile);
      search(next);
      picked.pop();
      filled[row] = filled[size + col] = filled[room] = 0;
      if (found.length >= limit) return;
    }
  }

  search(new Uint8Array(cells).fill(1));
  return found;
}

export function countSolutions(size: number, rooms: ArrayLike<number>, limit = 2): number {
  return findSolutions(size, rooms, limit).length;
}

/** Any one arrangement with a cat in every row and column and no two cats touching. */
function randomPlacement(size: number, random: Random): number[] {
  const cats: number[] = [];
  function place(row: number, usedColumns: number, previous: number): boolean {
    if (row === size) return true;
    const order = Array.from({ length: size }, (_, col) => col);
    for (let i = size - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const col of order) {
      if (usedColumns & (1 << col) || Math.abs(col - previous) <= 1) continue;
      cats.push(row * size + col);
      if (place(row + 1, usedColumns | (1 << col), col)) return true;
      cats.pop();
    }
    return false;
  }
  place(0, 0, -2);
  return cats;
}

/** Grows one room from each cat, favouring small rooms so they stay close in size. */
function growRooms(size: number, cats: number[], max: number, neighbors: number[][], random: Random) {
  const rooms = new Int8Array(size * size).fill(-1);
  const sizes = new Array<number>(size).fill(1);
  cats.forEach((tile, room) => { rooms[tile] = room; });
  for (let filled = size; filled < size * size; filled++) {
    const options: number[] = [];
    const weights: number[] = [];
    let total = 0;
    for (let tile = 0; tile < rooms.length; tile++) {
      if (rooms[tile] >= 0) continue;
      for (const neighbor of neighbors[tile]) {
        const room = rooms[neighbor];
        if (room < 0 || sizes[room] >= max) continue;
        options.push(tile * size + room);
        const weight = 1 / (sizes[room] * sizes[room]);
        weights.push(weight);
        total += weight;
      }
    }
    if (!options.length) return undefined;
    let pick = random() * total;
    let index = 0;
    while (index < options.length - 1 && pick > weights[index]) pick -= weights[index++];
    const tile = Math.floor(options[index] / size);
    const room = options[index] % size;
    rooms[tile] = room;
    sizes[room]++;
  }
  return { rooms, sizes };
}

function staysConnected(rooms: Int8Array, room: number, without: number, neighbors: number[][]): boolean {
  let start = -1;
  let total = 0;
  for (let tile = 0; tile < rooms.length; tile++) {
    if (rooms[tile] !== room || tile === without) continue;
    total++;
    if (start < 0) start = tile;
  }
  if (start < 0) return false;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    for (const next of neighbors[stack.pop()!]) {
      if (next !== without && rooms[next] === room && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen.size === total;
}

/**
 * Builds a board with exactly one solution. It picks where the cats go, grows a room around each
 * one, then keeps nudging border tiles between rooms to break any other solution.
 */
export function generateRooms(size: number, random: Random = Math.random, restarts = 40): Int8Array | undefined {
  if (!isPuzzleSize(size)) throw new RangeError(`Cat Quarters boards are ${MIN_SIZE} to ${MAX_SIZE} tiles wide`);
  const { min, max } = roomBounds(size);
  const neighbors = neighborsOf(size);
  for (let restart = 0; restart < restarts; restart++) {
    const placement = randomPlacement(size, random);
    const cats = new Set(placement);
    const grown = growRooms(size, placement, max, neighbors, random);
    if (!grown) continue;
    const { rooms, sizes } = grown;
    for (let step = 0; step < 2000; step++) {
      const solutions = findSolutions(size, rooms, 2);
      if (solutions.length === 1) {
        if (sizes.every(count => count >= min)) return rooms;
        break;
      }
      const other = solutions.find(solution => solution.some(tile => !cats.has(tile)));
      if (!other) break;
      // Move one of the other solution's cats into a neighbouring room, which then holds two of its cats.
      const moves: number[] = [];
      for (const tile of other) {
        if (cats.has(tile) || sizes[rooms[tile]] <= min) continue;
        for (const neighbor of neighbors[tile]) {
          const room = rooms[neighbor];
          if (room !== rooms[tile] && sizes[room] < max) moves.push(tile * size + room);
        }
      }
      for (let i = moves.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [moves[i], moves[j]] = [moves[j], moves[i]];
      }
      const move = moves.find(option =>
        staysConnected(rooms, rooms[Math.floor(option / size)], Math.floor(option / size), neighbors));
      if (move === undefined) {
        // Stuck: shift a random border tile so the next round sees a different board.
        const tile = Math.floor(random() * rooms.length);
        const neighbor = neighbors[tile][Math.floor(random() * neighbors[tile].length)];
        const from = rooms[tile];
        const to = rooms[neighbor];
        if (!cats.has(tile) && to !== from && sizes[from] > min && sizes[to] < max
          && staysConnected(rooms, from, tile, neighbors)) {
          rooms[tile] = to;
          sizes[from]--;
          sizes[to]++;
        }
        continue;
      }
      const tile = Math.floor(move / size);
      const to = move % size;
      sizes[rooms[tile]]--;
      rooms[tile] = to;
      sizes[to]++;
    }
  }
  return undefined;
}

/** Returns the board as rows of room letters, lettered in reading order, or undefined if it ran out of tries. */
export function generatePuzzle(size = DEFAULT_SIZE, random: Random = Math.random): string[] | undefined {
  const rooms = generateRooms(size, random);
  if (!rooms) return undefined;
  const order = new Map<number, string>();
  const letters = Array.from(rooms, room => {
    if (!order.has(room)) order.set(room, ROOM_LETTERS[order.size]);
    return order.get(room)!;
  }).join('');
  return Array.from({ length: size }, (_, row) => letters.slice(row * size, (row + 1) * size));
}
