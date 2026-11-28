import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EquationTowerGame, TOWER_LEVELS, towerLevel } from '../src/games/equationTower/EquationTowerGame';

vi.mock('../src/core/AudioController', () => ({
  AudioController: {
    getInstance: () => ({
      registerSound: vi.fn(),
      play: vi.fn(),
    }),
  },
}));

vi.mock('../src/core/HapticController', () => ({
  HapticController: {
    getInstance: () => ({
      lightTap: vi.fn(),
      success: vi.fn(),
    }),
  },
}));

const celebrate = vi.fn();
vi.mock('../src/ui/CelebrationOverlay', () => ({
  CelebrationOverlay: {
    getInstance: () => ({ celebrate }),
  },
}));

/** A 2D context where every method is a no-op and text is 10px per character. */
function mockContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {
    measureText: (t: string) => ({ width: t.length * 10 }),
  };
  return new Proxy(store, {
    get(target, prop) {
      if (!(prop in target)) target[prop] = vi.fn();
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Runs the game loop until every block has landed. */
function settle(game: EquationTowerGame) {
  for (let i = 0; i < 200; i++) game.update(16);
}

describe('EquationTowerGame', () => {
  let canvas: HTMLCanvasElement;
  let game: EquationTowerGame;
  const g = () => game as any;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement('canvas');
    canvas.width = 390;
    canvas.height = 700;
    canvas.getContext = vi.fn().mockReturnValue(mockContext()) as any;
    game = new EquationTowerGame();
    game.init(canvas);
  });

  it('starts on a small target with a tray that can make it', () => {
    expect(g().target).toBe(3);
    expect(g().tray).toEqual([1, 2]);
    expect(game.getSum()).toBe(0);
  });

  it('every set level can be built from its tray', () => {
    for (const lvl of TOWER_LEVELS) {
      expect(lvl.tray).toContain(1);
      expect(Math.max(...lvl.tray)).toBeLessThanOrEqual(lvl.target);
    }
  });

  it('later levels pick a new target from 5 to 10', () => {
    for (let i = 0; i < 50; i++) {
      const lvl = towerLevel(TOWER_LEVELS.length + 1, 7);
      expect(lvl.target).toBeGreaterThanOrEqual(5);
      expect(lvl.target).toBeLessThanOrEqual(10);
      expect(lvl.target).not.toBe(7);
    }
  });

  it('stacks each block on top of the last, as tall as its number', () => {
    game.addBlock(2);
    game.addBlock(1);
    settle(game);
    const L = g().layout;
    const [a, b] = g().blocks;
    expect(a.y).toBeCloseTo(L.baseY);
    expect(b.y).toBeCloseTo(L.baseY - 2 * L.unit);
    expect(game.getSum()).toBe(3);
  });

  it('wins only once the tower has landed exactly on the line', () => {
    game.addBlock(1);
    game.addBlock(2);
    expect(g().won).toBe(false);
    game.update(16);
    expect(g().won).toBe(false);
    settle(game);
    expect(g().won).toBe(true);
    expect(game.equationText()).toBe('1 + 2 = 3');
    expect(celebrate).toHaveBeenCalledTimes(1);
  });

  it('does not win when the tower goes past the line', () => {
    game.addBlock(2);
    game.addBlock(2);
    settle(game);
    expect(game.getSum()).toBe(4);
    expect(g().won).toBe(false);
  });

  it('tapping a tray tile drops that block', () => {
    const tile = g().layout.tiles[1];
    game.tapAt(tile.x + tile.w / 2, tile.y + tile.h / 2);
    expect(g().blocks.map((b: any) => b.value)).toEqual([2]);
  });

  it('tapping a block in the tower takes it off and the rest drop down', () => {
    game.addBlock(2);
    game.addBlock(2);
    settle(game);
    const L = g().layout;
    // Tap the bottom block
    game.tapAt(L.cx, L.baseY - L.unit);
    expect(g().blocks.map((b: any) => b.value)).toEqual([2]);
    settle(game);
    expect(g().blocks[0].y).toBeCloseTo(L.baseY);
  });

  it('refuses a block that would not fit on screen', () => {
    const L = g().layout;
    const room = Math.floor((L.baseY - L.tower.y) / L.unit);
    for (let i = 0; i < room; i++) game.addBlock(1);
    expect(game.addBlock(2)).toBe(false);
  });

  it('moves to the next tower after a win', () => {
    game.addBlock(1);
    game.addBlock(2);
    settle(game);
    const btn = g().nextBtn;
    expect(btn).not.toBeNull();
    game.tapAt(btn.x + btn.w / 2, btn.y + btn.h / 2);
    expect(g().level).toBe(2);
    expect(g().target).toBe(4);
    expect(g().blocks).toHaveLength(0);
    expect(g().won).toBe(false);
  });

  it('keeps the tower standing on resize', () => {
    game.addBlock(2);
    settle(game);
    canvas.width = 900;
    canvas.height = 420;
    game.resize();
    const L = g().layout;
    expect(L.mode).toBe('side');
    expect(g().blocks[0].y).toBeCloseTo(L.baseY);
  });

  it('plays from the keyboard: a number drops that block, Backspace takes one off', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '9' }));
    expect(g().blocks.map((b: any) => b.value)).toEqual([2]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(g().blocks).toHaveLength(0);
  });

  it('removes its listener on destroy', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    game.destroy();
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(g().canvas).toBeNull();
  });
});
