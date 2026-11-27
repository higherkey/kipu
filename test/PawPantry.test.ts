import { afterEach, describe, expect, it, vi } from 'vitest';
import { StateManager } from '../src/core/StateManager';
import { PawPantryGame } from '../src/games/pawPantry/PawPantryGame';
import { hint, LEVELS, makeBoard, neighbor, playSwap, seededRandom, SIZE } from '../src/games/pawPantry/PantryRules';

vi.mock('../src/core/HapticController', () => ({
  HapticController: { getInstance: () => ({ lightTap: vi.fn(), success: vi.fn() }) },
}));

describe('Paw Pantry rules', () => {
  it('starts each level with a playable board and rejects non-adjacent swaps', () => {
    for (const level of LEVELS) {
      const random = seededRandom(level.seed);
      const board = makeBoard(random);
      expect(board).toHaveLength(SIZE ** 2);
      expect(hint(board)).toBeDefined();
      expect(playSwap(board, SIZE - 1, SIZE, random)).toBeUndefined();
      expect(makeBoard(seededRandom(level.seed))).toEqual(board);
    }
  });

  it('counts each cleared treat once when a long match triggers a bonus clear', () => {
    const board = Array.from({ length: SIZE ** 2 }, (_, index) =>
      (Math.floor(index / SIZE) + index % SIZE) % 5);
    board.splice(0, SIZE, 0, 0, 2, 0, 0, 3);
    board[SIZE + 2] = 0;
    const start = [...board];
    const turn = playSwap(board, 2, SIZE + 2, seededRandom(8))!;
    const first = turn.waves[0];
    expect(first.cleared).toEqual(new Set([0, 1, 2, 3, 4, 5, 8, 14, 20, 26, 32]));
    expect(turn.collected.reduce((total, count) => total + count, 0))
      .toBe(turn.waves.reduce((total, wave) => total + wave.cleared.size, 0));
    expect(hint(turn.board)).toBeDefined();
    expect(board).toEqual(start);
  });
});

describe('Paw Pantry in the Lab', () => {
  const game = new PawPantryGame();

  afterEach(() => {
    game.destroy();
    StateManager.getInstance().set('pawPantryCompleted', 0);
    document.body.replaceChildren();
  });

  it('plays all four levels, saves progress, and restores the game canvas', () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    game.init(canvas);
    const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('.pantry-tile'));
    const picker = document.querySelector<HTMLSelectElement>('#pantry-level')!;
    const next = document.querySelector<HTMLButtonElement>('.pantry-next')!;
    const readBoard = () => tiles.map(tile => Number(tile.dataset.treat));

    const grid = document.querySelector('[role="grid"][aria-label="Treat board"]')!;
    expect(grid.querySelectorAll('[role="row"]')).toHaveLength(SIZE);
    expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(SIZE ** 2);
    tiles[0].focus();
    tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tiles[1]);
    expect(picker.options[1].disabled).toBe(true);
    for (const [index, level] of LEVELS.entries()) {
      expect(picker.selectedIndex).toBe(index);
      expect(readBoard()).toEqual(makeBoard(seededRandom(level.seed)));
      for (let count = 0; count < level.moves && tiles[0].getAttribute('aria-disabled') === 'false'; count++) {
        const board = readBoard();
        const swaps = board.flatMap((_, a) =>
          [neighbor(a, 0, 1), neighbor(a, 1, 0)].map(b => ({ a, b })));
        const best = swaps.map(({ a, b }) => {
          const turn = playSwap(board, a, b, seededRandom(17));
          const score = turn ? level.goals.reduce((sum, [treat], goal) => {
            const remaining = Number(document.querySelectorAll('.pantry-goals li strong')[goal].textContent) || 0;
            return sum + Math.min(remaining, turn.collected[treat]);
          }, 0) : -1;
          return { a, b, score };
        }).sort((x, y) => y.score - x.score)[0];
        tiles[best.a].click();
        tiles[best.b].click();
        for (let wave = 0; wave < 25; wave++) game.update(175);
      }
      expect(document.querySelector('.pantry-status')!.textContent).toMatch(/stocked/);
      expect(StateManager.getInstance().get('pawPantryCompleted')).toBe(index + 1);
      if (index < LEVELS.length - 1) next.click();
    }
    expect(next.hidden).toBe(true);
    game.destroy();
    expect(canvas.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.paw-pantry')).toBeNull();
    game.init(canvas);
    expect(document.querySelector<HTMLSelectElement>('#pantry-level')!.selectedIndex).toBe(LEVELS.length - 1);
  });

  it('keeps an illegal swap free and leaves the board unchanged', () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    game.init(canvas);
    const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('.pantry-tile'));
    const board = tiles.map(tile => Number(tile.dataset.treat));
    const a = board.findIndex((_, index) => {
      const b = neighbor(index, 0, 1);
      return b >= 0 && !playSwap(board, index, b, seededRandom(9));
    });
    tiles[a].click();
    tiles[a + 1].click();
    expect(tiles.map(tile => Number(tile.dataset.treat))).toEqual(board);
    expect(document.querySelector('.pantry-moves strong')!.textContent).toBe(String(LEVELS[0].moves));
    expect(document.querySelector('.pantry-status')!.textContent).toContain('no match');
  });
});
