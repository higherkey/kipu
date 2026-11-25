import { describe, it, expect } from 'vitest';
import {
  buildLevel, computeDefense, resolveAttack, canAttack, maxSendable,
  reinforcementsFor, checkOutcome, planRivalAttack, placeRivalReinforcements,
  getLevelInfo, seededRandom, PERFECT_BONUS, PLAYER_START, RIVAL_START,
  type Region,
} from '../src/games/suyu/SuyuRules';

function region(over: Partial<Region>): Region {
  return { id: 0, x: 0, y: 0, owner: 'neutral', troops: 3, wall: 0, hill: 1, banner: false, neighbors: [], ...over };
}

describe('SuyuRules: computeDefense', () => {
  it('uses plain knots when there are no modifiers', () => {
    const d = computeDefense(region({ troops: 4 }), false);
    expect(d.total).toBe(4);
    expect(d.steps).toEqual(['4 knots']);
  });

  it('adds walls', () => {
    expect(computeDefense(region({ troops: 4, wall: 3 }), false).total).toBe(7);
  });

  it('multiplies by hills before adding walls', () => {
    const d = computeDefense(region({ troops: 3, hill: 2, wall: 1 }), false);
    expect(d.total).toBe(7);
    expect(d.steps).toEqual(['3 × 2 = 6', '6 + 1 = 7']);
  });

  it('halves (rounding up) when attacking from a banner', () => {
    const d = computeDefense(region({ troops: 3, hill: 2, wall: 1 }), true);
    expect(d.total).toBe(4);
    expect(d.steps.at(-1)).toBe('half of 7 → 4');
  });
});

describe('SuyuRules: resolveAttack', () => {
  function pair(targetOver: Partial<Region> = {}) {
    return [
      region({ id: 0, owner: 'player', troops: 10, neighbors: [1] }),
      region({ id: 1, troops: 4, neighbors: [0], ...targetOver }),
    ];
  }

  it('captures with a perfect send and grants bonus knots', () => {
    const rs = pair();
    const res = resolveAttack(rs, 0, 1, 4);
    expect(res).toMatchObject({ success: true, perfect: true, needed: 4, survivors: PERFECT_BONUS });
    expect(rs[1].owner).toBe('player');
    expect(rs[1].troops).toBe(PERFECT_BONUS);
    expect(rs[0].troops).toBe(6);
  });

  it('captures with an overshoot and moves the survivors in', () => {
    const rs = pair({ wall: 2 });
    const res = resolveAttack(rs, 0, 1, 9);
    expect(res).toMatchObject({ success: true, perfect: false, needed: 6, survivors: 3 });
    expect(rs[1].troops).toBe(3);
    expect(rs[0].troops).toBe(1);
  });

  it('fails when too few are sent and leaves the defender unchanged', () => {
    const rs = pair({ hill: 2 });
    const res = resolveAttack(rs, 0, 1, 7);
    expect(res).toMatchObject({ success: false, needed: 8 });
    expect(rs[1]).toMatchObject({ owner: 'neutral', troops: 4 });
    expect(rs[0].troops).toBe(3);
  });

  it('never sends the last knot home', () => {
    const rs = pair();
    const res = resolveAttack(rs, 0, 1, 99);
    expect(res.sent).toBe(9);
    expect(rs[0].troops).toBe(1);
  });

  it('rejects non-adjacent, own-region, and weak attacks', () => {
    const rs = [
      region({ id: 0, owner: 'player', troops: 5, neighbors: [1] }),
      region({ id: 1, owner: 'player', troops: 1, neighbors: [0, 2] }),
      region({ id: 2, troops: 2, neighbors: [1] }),
    ];
    expect(canAttack(rs, 0, 2)).toBe(false);
    expect(canAttack(rs, 0, 1)).toBe(false);
    expect(canAttack(rs, 1, 2)).toBe(false);
    expect(() => resolveAttack(rs, 0, 2, 3)).toThrow();
    expect(maxSendable(rs[0])).toBe(4);
  });
});

describe('SuyuRules: levels, turns, and rival', () => {
  it('builds a connected 9-region map with both starting regions', () => {
    for (const lvl of [1, 2, 3, 4, 7]) {
      const rs = buildLevel(lvl);
      expect(rs).toHaveLength(9);
      expect(rs[PLAYER_START].owner).toBe('player');
      expect(rs[RIVAL_START].owner).toBe('rival');
      for (const r of rs) for (const n of r.neighbors) expect(rs[n].neighbors).toContain(r.id);
    }
  });

  it('introduces one new mechanic per teaching level', () => {
    expect(buildLevel(1).some(r => r.wall || r.hill > 1 || r.banner)).toBe(false);
    expect(buildLevel(2).some(r => r.owner === 'neutral' && r.wall > 0)).toBe(true);
    expect(buildLevel(3).some(r => r.hill > 1)).toBe(true);
    expect(buildLevel(4)[PLAYER_START].banner).toBe(true);
    expect(getLevelInfo(1).showTotals).toBe(true);
    expect(getLevelInfo(9).title).toBe('Mastery');
  });

  it('generates reproducible levels beyond the authored ones', () => {
    expect(buildLevel(6)).toEqual(buildLevel(6));
    const r = seededRandom(1);
    expect(r()).toBeGreaterThanOrEqual(0);
  });

  it('computes reinforcements and outcome', () => {
    const rs = buildLevel(1);
    expect(reinforcementsFor(rs, 'player')).toBe(3);
    expect(checkOutcome(rs)).toBe('playing');
    rs[RIVAL_START].owner = 'player';
    expect(checkOutcome(rs)).toBe('won');
  });

  it('rival reinforces a frontier and plans a winnable, non-perfect attack', () => {
    const rs = buildLevel(1);
    const placed = placeRivalReinforcements(rs);
    expect(placed).toBe(RIVAL_START);
    const plan = planRivalAttack(rs)!;
    expect(plan).not.toBeNull();
    expect(plan.from).toBe(RIVAL_START);
    const needed = computeDefense(rs[plan.to], rs[plan.from].banner).total;
    expect(plan.sent).toBe(needed + 1);
    expect(plan.sent).toBeLessThanOrEqual(maxSendable(rs[plan.from]));
  });
});
