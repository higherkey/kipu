/**
 * Suyu — pure game rules (no rendering, no audio).
 *
 * Core idea: battles are deterministic. A region's defense is its knots
 * (troops) run through its modifiers. The player must work that number out
 * and send at least that many knots. Sending EXACTLY the defense is a
 * "perfect capture" and earns a star plus bonus knots.
 *
 *   defense = ((knots × hill) + wall), halved (rounded up) if the attacker
 *   launches from a Banner region.
 */

export type Owner = 'player' | 'rival' | 'neutral';

export interface Region {
  id: number;
  /** Normalized map position, 0..1 */
  x: number;
  y: number;
  owner: Owner;
  troops: number;
  /** Flat bonus added to defense ("Wall +3"). 0 = none. */
  wall: number;
  /** Defense multiplier ("Hill ×2"). 1 = none. */
  hill: number;
  /** Attacks launched FROM a banner region halve the target's defense. */
  banner: boolean;
  neighbors: number[];
}

export interface DefenseBreakdown {
  base: number;
  afterHill: number;
  afterWall: number;
  halved: boolean;
  total: number;
  /** Human-readable working, e.g. ["4 × 2 = 8", "8 + 3 = 11", "half of 11 → 6"] */
  steps: string[];
}

export interface AttackResult {
  success: boolean;
  perfect: boolean;
  needed: number;
  sent: number;
  /** Knots that move into the captured region (0 on failure). */
  survivors: number;
  breakdown: DefenseBreakdown;
}

export interface LevelInfo {
  level: number;
  title: string;
  /** Short rule reminder shown at level start. */
  lesson: string;
  /** If true the needed total is displayed (tutorial level). */
  showTotals: boolean;
  /** Max rival attacks per turn — keeps early levels gentle. */
  rivalAttacks: number;
}

export const PERFECT_BONUS = 2;
export const PLAYER_START = 0;
export const RIVAL_START = 8;

/** 9-region map: three loose rows with cord connections between neighbors. */
const MAP_POSITIONS: Array<[number, number]> = [
  [0.12, 0.16], [0.48, 0.1], [0.86, 0.18],
  [0.18, 0.52], [0.52, 0.47], [0.84, 0.54],
  [0.14, 0.88], [0.5, 0.86], [0.88, 0.86],
];

const MAP_LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5],
  [3, 4], [4, 5], [3, 6], [4, 7], [5, 8],
  [6, 7], [7, 8],
];

const LEVELS: LevelInfo[] = [
  { level: 1, title: 'Counting', lesson: 'Send at least as many knots as the region has. Exactly the same = Perfect!', showTotals: true, rivalAttacks: 1 },
  { level: 2, title: 'Walls', lesson: 'A Wall adds knots to the defense. 4 knots + Wall 3 = 7.', showTotals: false, rivalAttacks: 2 },
  { level: 3, title: 'Hills', lesson: 'A Hill multiplies the defense. 3 knots on Hill ×2 = 6.', showTotals: false, rivalAttacks: 2 },
  { level: 4, title: 'Banners', lesson: 'Attack FROM a Banner and the defense is cut in half (round up).', showTotals: false, rivalAttacks: 3 },
];

export function getLevelInfo(level: number): LevelInfo {
  if (level <= LEVELS.length) return LEVELS[level - 1];
  return { level, title: 'Mastery', lesson: 'Hills first, then Walls, then Banners. You can do it!', showTotals: false, rivalAttacks: 3 };
}

/** Small deterministic PRNG so generated levels are reproducible. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blankMap(): Region[] {
  const regions: Region[] = MAP_POSITIONS.map(([x, y], id) => ({
    id, x, y, owner: 'neutral', troops: 3, wall: 0, hill: 1, banner: false, neighbors: [],
  }));
  for (const [a, b] of MAP_LINKS) {
    regions[a].neighbors.push(b);
    regions[b].neighbors.push(a);
  }
  return regions;
}

type Mod = { troops: number; wall?: number; hill?: number; banner?: boolean };

/** Hand-authored neutral setups for the teaching levels (index = region id). */
const AUTHORED: Record<number, Record<number, Mod>> = {
  1: { 1: { troops: 3 }, 2: { troops: 5 }, 3: { troops: 2 }, 4: { troops: 4 }, 5: { troops: 3 }, 6: { troops: 4 }, 7: { troops: 6 } },
  2: { 1: { troops: 2, wall: 2 }, 2: { troops: 3 }, 3: { troops: 3, wall: 1 }, 4: { troops: 4, wall: 3 }, 5: { troops: 2, wall: 2 }, 6: { troops: 5 }, 7: { troops: 3, wall: 3 } },
  3: { 1: { troops: 2, hill: 2 }, 2: { troops: 4 }, 3: { troops: 3, hill: 2 }, 4: { troops: 3, hill: 3 }, 5: { troops: 2, wall: 2 }, 6: { troops: 4, hill: 2 }, 7: { troops: 2, wall: 4 } },
  4: { 1: { troops: 3, hill: 2, wall: 2 }, 2: { troops: 4, banner: true }, 3: { troops: 2, hill: 2 }, 4: { troops: 4, hill: 2, wall: 1 }, 5: { troops: 3, wall: 3 }, 6: { troops: 3, banner: true }, 7: { troops: 5, hill: 2 } },
};

export function buildLevel(level: number): Region[] {
  const regions = blankMap();
  const authored = AUTHORED[level];

  if (authored) {
    for (const [id, mod] of Object.entries(authored)) {
      const r = regions[Number(id)];
      r.troops = mod.troops;
      r.wall = mod.wall ?? 0;
      r.hill = mod.hill ?? 1;
      r.banner = mod.banner ?? false;
    }
  } else {
    const rand = seededRandom(level * 7919);
    for (const r of regions) {
      r.troops = 2 + Math.floor(rand() * 4);
      const roll = rand();
      if (roll < 0.3) r.hill = rand() < 0.75 ? 2 : 3;
      if (rand() < 0.45) r.wall = 1 + Math.floor(rand() * 4);
      if (roll > 0.85) r.banner = true;
    }
  }

  const player = regions[PLAYER_START];
  Object.assign(player, { owner: 'player', troops: 7, wall: 0, hill: 1, banner: level >= 4 });
  const rival = regions[RIVAL_START];
  Object.assign(rival, { owner: 'rival', troops: 6 + Math.min(4, level), wall: level >= 2 ? 1 : 0, hill: 1, banner: false });

  return regions;
}

export function computeDefense(target: Region, attackerHasBanner: boolean): DefenseBreakdown {
  const base = target.troops;
  const afterHill = base * target.hill;
  const afterWall = afterHill + target.wall;
  const total = attackerHasBanner ? Math.ceil(afterWall / 2) : afterWall;

  const steps: string[] = [];
  if (target.hill > 1) steps.push(`${base} × ${target.hill} = ${afterHill}`);
  if (target.wall > 0) steps.push(`${afterHill} + ${target.wall} = ${afterWall}`);
  if (attackerHasBanner) steps.push(`half of ${afterWall} → ${total}`);
  if (steps.length === 0) steps.push(`${base} knots`);

  return { base, afterHill, afterWall, halved: attackerHasBanner, total, steps };
}

export function canAttack(regions: Region[], fromId: number, toId: number): boolean {
  const from = regions[fromId];
  const to = regions[toId];
  if (!from || !to) return false;
  if (from.owner === 'neutral' || from.owner === to.owner) return false;
  if (!from.neighbors.includes(toId)) return false;
  return from.troops >= 2;
}

/** Largest number of knots a region can send (one must stay home). */
export function maxSendable(region: Region): number {
  return Math.max(0, region.troops - 1);
}

/**
 * Resolve an attack and mutate the regions.
 * Success when sent >= defense. Survivors (sent − defense) move in;
 * a perfect capture (sent === defense) moves in PERFECT_BONUS knots instead.
 * A failed attack loses the sent knots; the defender is unchanged.
 */
export function resolveAttack(regions: Region[], fromId: number, toId: number, sent: number): AttackResult {
  if (!canAttack(regions, fromId, toId)) {
    throw new Error(`Invalid attack ${fromId} → ${toId}`);
  }
  const from = regions[fromId];
  const to = regions[toId];
  const amount = Math.max(1, Math.min(Math.floor(sent), maxSendable(from)));
  const breakdown = computeDefense(to, from.banner);
  const needed = breakdown.total;

  from.troops -= amount;

  if (amount >= needed) {
    const perfect = amount === needed;
    const survivors = perfect ? PERFECT_BONUS : amount - needed;
    to.owner = from.owner;
    to.troops = Math.max(1, survivors);
    return { success: true, perfect, needed, sent: amount, survivors: to.troops, breakdown };
  }

  return { success: false, perfect: false, needed, sent: amount, survivors: 0, breakdown };
}

export function countOwned(regions: Region[], owner: Owner): number {
  return regions.filter(r => r.owner === owner).length;
}

/** Knots gained at the start of a turn. */
export function reinforcementsFor(regions: Region[], owner: Owner): number {
  const owned = countOwned(regions, owner);
  return owned === 0 ? 0 : 2 + owned;
}

export type Outcome = 'playing' | 'won' | 'lost';

export function checkOutcome(regions: Region[]): Outcome {
  if (countOwned(regions, 'player') === 0) return 'lost';
  if (countOwned(regions, 'rival') === 0) return 'won';
  return 'playing';
}

function isFrontier(regions: Region[], r: Region): boolean {
  return r.neighbors.some(n => regions[n].owner !== r.owner);
}

/** Rival puts all reinforcements on its strongest frontier region. Returns region id or -1. */
export function placeRivalReinforcements(regions: Region[]): number {
  const amount = reinforcementsFor(regions, 'rival');
  const own = regions.filter(r => r.owner === 'rival');
  if (own.length === 0 || amount === 0) return -1;
  const frontier = own.filter(r => isFrontier(regions, r));
  const pool = frontier.length > 0 ? frontier : own;
  const target = pool.reduce((best, r) => (r.troops > best.troops ? r : best), pool[0]);
  target.troops += amount;
  return target.id;
}

export interface PlannedAttack { from: number; to: number; sent: number }

/**
 * Rival picks the cheapest winnable attack, preferring player regions.
 * It sends defense + 1 (never perfect) so the player keeps the edge.
 */
export function planRivalAttack(regions: Region[]): PlannedAttack | null {
  let best: { plan: PlannedAttack; score: number } | null = null;
  for (const from of regions) {
    if (from.owner !== 'rival' || from.troops < 2) continue;
    for (const toId of from.neighbors) {
      const to = regions[toId];
      if (to.owner === 'rival') continue;
      const needed = computeDefense(to, from.banner).total;
      const sent = needed + 1;
      if (sent > maxSendable(from)) continue;
      const score = needed - (to.owner === 'player' ? 3 : 0) - (to.banner ? 2 : 0);
      if (!best || score < best.score) best = { plan: { from: from.id, to: toId, sent }, score };
    }
  }
  return best ? best.plan : null;
}
