import { expect, it } from 'vitest';
import { botAction, canCapture, capture, captureCost, createFortressState, endTurn, reinforce } from '../src/games/fortressMath/FortressRules';

it('finishes a legal match against both bots when the child leaves extra defenders', () => {
  const state = createFortressState();
  for (let turn = 0; turn < 90 && state.winner === null; turn++) {
    if (state.turn === 0) {
      while (state.actions > 0) {
        const target = state.regions.filter(region => canCapture(state, region.id))
          .sort((a, b) => captureCost(a) - captureCost(b))[0];
        if (target) {
          expect(capture(state, target.id, Math.min(state.reserves[0], captureCost(target) + 2))).toBe(true);
        } else {
          const own = state.regions.filter(region => region.owner === 0 && region.troops <= 6)
            .sort((a, b) => a.troops - b.troops)[0];
          if (!own || !reinforce(state, own.id)) break;
        }
      }
    } else {
      botAction(state);
      botAction(state);
    }
    expect(state.reserves.every(value => value >= 0 && value <= 20)).toBe(true);
    for (const player of [0, 1, 2]) expect(state.regions.some(region => region.owner === player)).toBe(true);
    endTurn(state);
  }
  expect(state.winner).toBe(0);
  expect(state.round).toBeLessThan(30);
});
