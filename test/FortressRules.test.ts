import { describe, expect, it } from 'vitest';
import { botAction, canCapture, capture, captureCost, createFortressState, endTurn, neighbors, reinforce } from '../src/games/fortressMath/FortressRules';

describe('Fortress rules', () => {
    it('starts three players with two actions and bounded neutral defenses', () => {
        const state = createFortressState();

        expect(state.regions).toHaveLength(12);
        expect(state.regions.filter(region => region.owner !== null).map(region => [region.id, region.owner, region.troops, region.shields]))
            .toEqual([[0, 0, 3, 0], [3, 1, 3, 0], [11, 2, 3, 0]]);
        expect(state).toMatchObject({ turn: 0, actions: 2, round: 1, reserves: [8, 8, 8], winner: null });
        for (const region of state.regions.filter(region => region.owner === null)) {
            expect(region.troops).toBeGreaterThanOrEqual(1);
            expect(region.troops).toBeLessThanOrEqual(4);
            expect([0, 1]).toContain(region.shields);
            expect(captureCost(region)).toBeLessThanOrEqual(6);
        }
        state.regions[1].troops = 8;
        expect(createFortressState().regions[1].troops).not.toBe(8);
    });

    it('uses orthogonal neighbors without wrapping rows', () => {
        expect(neighbors(0).sort()).toEqual([1, 4]);
        expect(neighbors(3).sort()).toEqual([2, 7]);
        expect(neighbors(4).sort()).toEqual([0, 5, 8]);
        expect(neighbors(5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
        expect(neighbors(11).sort((a, b) => a - b)).toEqual([7, 10]);
        for (const id of [-1, 12, 1.5, NaN]) expect(neighbors(id)).toEqual([]);
    });

    it.each([-1, 0, 1, 2, 1.5, NaN, Infinity, 21])('rejects invalid amount %s without mutations', amount => {
        const state = createFortressState();
        const before = structuredClone(state);

        expect(capture(state, 1, amount)).toBe(false);
        expect(state).toEqual(before);
    });

    it('requires an affordable adjacent target and keeps rejected state intact', () => {
        const state = createFortressState();
        state.reserves[0] = captureCost(state.regions[1]) - 1;
        const before = structuredClone(state);

        expect(canCapture(state, 1)).toBe(false);
        expect(capture(state, 1, captureCost(state.regions[1]))).toBe(false);
        for (const id of [0, 2, 3, 11, 12, -1, 1.5, NaN]) {
            expect(canCapture(state, id)).toBe(false);
            expect(capture(state, id, 4)).toBe(false);
        }
        expect(state).toEqual(before);
    });

    it('spends global reserve, preserves shields, and leaves surviving troops', () => {
        const state = createFortressState();
        state.regions[0].troops = 1;
        Object.assign(state.regions[1], { troops: 3, shields: 1 });

        expect(captureCost(state.regions[1])).toBe(5);
        expect(canCapture(state, 1)).toBe(true);
        expect(capture(state, 1, 7)).toBe(true);
        expect(state.regions[1]).toMatchObject({ owner: 0, troops: 3, shields: 1 });
        expect(state.regions[0].troops).toBe(1);
        expect(state.reserves).toEqual([1, 8, 8]);
        expect(state.actions).toBe(1);
        expect(state.log.join(' ')).toContain(state.regions[1].name);
    });

    it('caps captured troops at eight and permits enemy capture only with another stronghold', () => {
        const state = createFortressState();
        Object.assign(state.regions[1], { owner: 1, troops: 1, shields: 0 });
        state.reserves[0] = 20;

        expect(capture(state, 1, 20)).toBe(true);
        expect(state.regions[1].troops).toBe(8);
        Object.assign(state.regions[2], { owner: 0 });
        state.reserves[0] = 10;
        const before = structuredClone(state);
        expect(canCapture(state, 3)).toBe(false);
        expect(capture(state, 3, 2)).toBe(false);
        expect(state).toEqual(before);
    });

    it('reinforces owned regions for two reserve and two troops up to eight', () => {
        const state = createFortressState();
        state.regions[0].troops = 6;

        expect(reinforce(state, 0)).toBe(true);
        expect(state.regions[0].troops).toBe(8);
        expect(state.reserves[0]).toBe(6);
        expect(state.actions).toBe(1);
        const before = structuredClone(state);
        for (const id of [0, 1, 3, -1, 12, NaN]) expect(reinforce(state, id)).toBe(false);
        expect(state).toEqual(before);
        state.regions[0].troops = 7;
        expect(reinforce(state, 0)).toBe(false);
        state.regions[0].troops = 5;
        state.reserves[0] = 1;
        const poor = structuredClone(state);
        expect(reinforce(state, 0)).toBe(false);
        expect(state).toEqual(poor);
    });

    it('advances clockwise, grants capped reserve to the new player, and increments rounds', () => {
        const state = createFortressState();
        state.actions = 0;
        state.reserves = [19, 18, 0];

        endTurn(state);
        expect(state).toMatchObject({ turn: 1, actions: 2, round: 1, reserves: [19, 20, 0] });
        endTurn(state);
        expect(state).toMatchObject({ turn: 2, actions: 2, round: 1, reserves: [19, 20, 3] });
        endTurn(state);
        expect(state).toMatchObject({ turn: 0, actions: 2, round: 2, reserves: [20, 20, 3] });
    });

    it('requires holding five regions until the start of that player’s next turn', () => {
        const state = createFortressState();
        for (const id of [1, 2, 4, 5]) state.regions[id].owner = 0;

        endTurn(state);
        expect(state.winner).toBeNull();
        endTurn(state);
        expect(state.winner).toBeNull();
        endTurn(state);
        expect(state.winner).toBe(0);
    });

    it('does not declare a winner who loses their fifth region before their next turn', () => {
        const state = createFortressState();
        for (const id of [1, 2, 4, 5]) state.regions[id].owner = 0;
        endTurn(state);
        state.regions[1].owner = 1;
        endTurn(state);
        endTurn(state);
        expect(state.winner).toBeNull();
    });

    it('prevents capture and reinforcement without actions', () => {
        const state = createFortressState();
        state.actions = 0;
        const before = structuredClone(state);

        expect(canCapture(state, 1)).toBe(false);
        expect(capture(state, 1, 8)).toBe(false);
        expect(reinforce(state, 0)).toBe(false);
        expect(state).toEqual(before);
    });

    it('has the expanding bot capture the cheapest legal region deterministically', () => {
        const state = createFortressState();
        state.turn = 1;
        Object.assign(state.regions[2], { troops: 4, shields: 1 });
        Object.assign(state.regions[7], { troops: 1, shields: 0 });
        const duplicate = structuredClone(state);

        botAction(state);
        botAction(duplicate);

        expect(state).toEqual(duplicate);
        expect(state.regions[7]).toMatchObject({ owner: 1, troops: 1 });
        expect(state.reserves[1]).toBe(6);
        expect(state).toMatchObject({ turn: 1, actions: 1 });
    });

    it('has the defensive bot strengthen a vulnerable border before expanding', () => {
        const state = createFortressState();
        state.turn = 2;
        Object.assign(state.regions[7], { owner: 1, troops: 4 });

        botAction(state);

        expect(state.regions[11].troops).toBe(5);
        expect(state.reserves[2]).toBe(6);
        expect(state).toMatchObject({ turn: 2, actions: 1 });
    });

    it('has the defensive bot capture when its border has no opponent', () => {
        const state = createFortressState();
        state.turn = 2;
        Object.assign(state.regions[10], { troops: 1, shields: 0 });

        botAction(state);

        expect(state.regions[10]).toMatchObject({ owner: 2, troops: 1 });
        expect(state).toMatchObject({ turn: 2, actions: 1 });
    });

    it('keeps long deterministic play within army and ownership limits', () => {
        const state = createFortressState();

        for (let turn = 0; turn < 100 && state.winner === null; turn++) {
            if (state.turn === 0) {
                const target = state.regions.find(region => canCapture(state, region.id));
                if (target) capture(state, target.id, captureCost(target));
            } else {
                botAction(state);
                botAction(state);
            }
            for (const player of [0, 1, 2]) {
                expect(state.regions.some(region => region.owner === player)).toBe(true);
                expect(state.reserves[player]).toBeGreaterThanOrEqual(0);
                expect(state.reserves[player]).toBeLessThanOrEqual(20);
            }
            for (const region of state.regions) {
                expect(region.troops).toBeGreaterThanOrEqual(1);
                expect(region.troops).toBeLessThanOrEqual(8);
                expect(captureCost(region)).toBeLessThanOrEqual(10);
            }
            endTurn(state);
        }
    });

    it('has bots reinforce when capture is unaffordable and stop if no move is legal', () => {
        const state = createFortressState();
        state.turn = 1;
        state.reserves[1] = 2;
        for (const id of [2, 7]) Object.assign(state.regions[id], { troops: 4, shields: 1 });

        botAction(state);
        expect(state.regions[3].troops).toBe(5);
        expect(state.reserves[1]).toBe(0);
        botAction(state);
        expect(state).toMatchObject({ turn: 1, actions: 0 });
    });

    it('leaves human, exhausted, and won states unchanged when bots are called', () => {
        for (const settings of [{ turn: 0 as const }, { turn: 1 as const, actions: 0 }, { turn: 2 as const, winner: 0 as const }]) {
            const state = Object.assign(createFortressState(), settings);
            const before = structuredClone(state);

            botAction(state);

            expect(state).toEqual(before);
        }
    });

    it.each([0, 1, 2] as const)('keeps terminal state immutable for winner %s', winner => {
        const state = createFortressState();
        state.winner = winner;
        const before = structuredClone(state);

        expect(canCapture(state, 1)).toBe(false);
        expect(capture(state, 1, 8)).toBe(false);
        expect(reinforce(state, 0)).toBe(false);
        endTurn(state);
        botAction(state);

        expect(state).toEqual(before);
    });
});
