export type Player = 0 | 1 | 2;

export interface Region {
    id: number;
    name: string;
    owner: Player | null;
    troops: number;
    shields: number;
}

export interface FortressState {
    regions: Region[];
    turn: Player;
    actions: number;
    round: number;
    reserves: number[];
    winner: Player | null;
    log: string[];
}

export function createFortressState(): FortressState {
    const names = ['Sun Keep', 'Clover Field', 'Copper Hill', 'Moon Tower', 'Willow Wood', 'River Gate', 'Crystal Lake', 'Stone Bridge', 'Golden Meadow', 'Cloud Peak', 'Ember Valley', 'Star Citadel'];
    const troops = [3, 2, 3, 3, 1, 4, 2, 3, 2, 4, 1, 3];
    const regions = names.map((name, id): Region => ({
        id,
        name,
        owner: id === 0 ? 0 : id === 3 ? 1 : id === 11 ? 2 : null,
        troops: troops[id],
        shields: [2, 5, 7, 9].includes(id) ? 1 : 0,
    }));
    return { regions, turn: 0, actions: 2, round: 1, reserves: [8, 8, 8], winner: null, log: [] };
}

export function neighbors(id: number): number[] {
    if (!Number.isInteger(id) || id < 0 || id >= 12) return [];
    const result: number[] = [];
    if (id >= 4) result.push(id - 4);
    if (id % 4 > 0) result.push(id - 1);
    if (id % 4 < 3) result.push(id + 1);
    if (id < 8) result.push(id + 4);
    return result;
}

export function captureCost(region: Region): number {
    return region.troops + region.shields + 1;
}

export function canCapture(state: FortressState, targetId: number): boolean {
    if (state.winner !== null || state.actions <= 0) return false;
    const target = state.regions.find(region => region.id === targetId);
    if (!target || target.owner === state.turn || captureCost(target) > state.reserves[state.turn]) return false;
    if (target.owner !== null && state.regions.filter(region => region.owner === target.owner).length <= 1) return false;
    return neighbors(targetId).some(id => state.regions.some(region => region.id === id && region.owner === state.turn));
}

export function capture(state: FortressState, targetId: number, amount: number): boolean {
    if (!Number.isInteger(amount) || !canCapture(state, targetId)) return false;
    const target = state.regions.find(region => region.id === targetId)!;
    if (amount < captureCost(target) || amount > state.reserves[state.turn]) return false;
    state.reserves[state.turn] -= amount;
    target.troops = Math.min(8, amount - target.troops - target.shields);
    target.owner = state.turn;
    state.actions--;
    state.log.push(`${playerName(state.turn)} captured ${target.name} with ${amount} troops; ${target.troops} remain.`);
    return true;
}

export function reinforce(state: FortressState, id: number): boolean {
    if (state.winner !== null || state.actions <= 0 || state.reserves[state.turn] < 2) return false;
    const region = state.regions.find(region => region.id === id);
    if (!region || region.owner !== state.turn || region.troops > 6) return false;
    state.reserves[state.turn] -= 2;
    region.troops += 2;
    state.actions--;
    state.log.push(`${playerName(state.turn)} reinforced ${region.name} to ${region.troops} troops.`);
    return true;
}

export function endTurn(state: FortressState): void {
    if (state.winner !== null) return;
    state.turn = ((state.turn + 1) % 3) as Player;
    state.actions = 2;
    state.reserves[state.turn] = Math.min(20, state.reserves[state.turn] + 3);
    if (state.turn === 0) state.round++;
    if (state.regions.filter(region => region.owner === state.turn).length >= 5) {
        state.winner = state.turn;
        state.log.push(`${playerName(state.turn)} held five regions and won!`);
    } else {
        state.log.push(`${playerName(state.turn)} starts a turn with ${state.reserves[state.turn]} reserve troops.`);
    }
}

export function botAction(state: FortressState): void {
    if (state.turn === 0 || state.winner !== null || state.actions <= 0) return;
    const owned = state.regions.filter(region => region.owner === state.turn);
    if (state.turn === 2) {
        const vulnerable = owned.filter(region => region.troops <= 4 && neighbors(region.id).some(id => {
            const neighbor = state.regions.find(candidate => candidate.id === id);
            return neighbor && neighbor.owner !== null && neighbor.owner !== state.turn;
        })).sort((a, b) => a.troops - b.troops || a.id - b.id);
        if (vulnerable.length && reinforce(state, vulnerable[0].id)) return;
    }
    const targets = state.regions.filter(region => canCapture(state, region.id))
        .sort((a, b) => captureCost(a) - captureCost(b) || a.id - b.id);
    if (targets.length && capture(state, targets[0].id, captureCost(targets[0]))) return;
    const weakest = owned.filter(region => region.troops <= 6).sort((a, b) => a.troops - b.troops || a.id - b.id);
    if (weakest.length && reinforce(state, weakest[0].id)) return;
    state.actions = 0;
}

function playerName(player: Player): string {
    return ['You', 'Copper Fox', 'Star Owl'][player];
}
