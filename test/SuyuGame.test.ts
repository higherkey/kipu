import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuyuGame } from '../src/games/suyu/SuyuGame';
import { PLAYER_START, RIVAL_START } from '../src/games/suyu/SuyuRules';

vi.mock('../src/core/AudioController', () => ({
  AudioController: { getInstance: () => ({ registerSound: vi.fn(), play: vi.fn() }) },
}));
vi.mock('../src/core/HapticController', () => ({
  HapticController: { getInstance: () => ({ lightTap: vi.fn(), heavyImpact: vi.fn(), success: vi.fn() }) },
}));

function makeCtx() {
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 7 });
      const fn = vi.fn();
      target[prop] = fn;
      return fn;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
}

describe('SuyuGame', () => {
  let canvas: HTMLCanvasElement;
  let game: SuyuGame;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 390;
    canvas.height = 780;
    canvas.getContext = vi.fn().mockReturnValue(makeCtx());
    game = new SuyuGame();
    game.init(canvas);
  });

  const tapRegion = (id: number) => {
    const p = game.regionPos(game.getState().regions[id]);
    game.handleTap(p.x, p.y);
  };

  it('starts on the level intro card and begins on tap', () => {
    expect(game.getState().phase).toBe('intro');
    game.handleTap(5, 5);
    expect(game.getState().phase).toBe('place');
    expect(game.getState().placeRemaining).toBe(3);
  });

  it('places reinforcements only on player regions, then moves to attack', () => {
    game.handleTap(5, 5);
    tapRegion(1); // neutral: ignored
    expect(game.getState().placeRemaining).toBe(3);
    tapRegion(PLAYER_START);
    tapRegion(PLAYER_START);
    tapRegion(PLAYER_START);
    const s = game.getState();
    expect(s.phase).toBe('attack');
    expect(s.regions[PLAYER_START].troops).toBe(10);
  });

  it('selects source and target and awards a star for a perfect capture', () => {
    game.handleTap(5, 5);
    for (let i = 0; i < 3; i++) tapRegion(PLAYER_START);
    tapRegion(PLAYER_START);
    tapRegion(1); // neutral with 3 knots on level 1
    expect(game.getState().selectedTo).toBe(1);
    // Drive the stepper and attack via private actions (button geometry is layout-dependent).
    const g = game as unknown as { adjustSend(d: number): void; doAttack(): void };
    g.adjustSend(1);
    g.adjustSend(1);
    expect(game.getState().sendAmount).toBe(3);
    g.doAttack();
    const s = game.getState();
    expect(s.regions[1].owner).toBe('player');
    expect(s.stars).toBe(1);
  });

  it('runs a rival turn and returns control to the player', () => {
    game.handleTap(5, 5);
    for (let i = 0; i < 3; i++) tapRegion(PLAYER_START);
    (game as unknown as { pressButton(id: string): void }).pressButton('endTurn');
    expect(game.getState().phase).toBe('rival');
    for (let i = 0; i < 40 && game.getState().phase === 'rival'; i++) game.update(100);
    expect(game.getState().phase).toBe('place');
    expect(game.getState().regions[RIVAL_START].owner).toBe('rival');
  });

  it('advances to the next level after a win', () => {
    const regions = game.getState().regions;
    regions[RIVAL_START].owner = 'player';
    (game as unknown as { endLevel(o: string): void }).endLevel('won');
    expect(game.getState().phase).toBe('won');
    (game as unknown as { pressButton(id: string): void }).pressButton('next');
    expect(game.getState().level).toBe(2);
    expect(game.getState().phase).toBe('intro');
  });

  it('pauses, renders, and cleans up without throwing', () => {
    game.pause();
    game.update(16);
    game.resume();
    game.update(16);
    game.resize();
    game.destroy();
    expect(game.getState().regions).toHaveLength(0);
  });
});
