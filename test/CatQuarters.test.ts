import { afterEach, describe, expect, it } from 'vitest';
import { CatQuartersGame } from '../src/games/catQuarters/CatQuartersGame';
import { findConflicts, PUZZLES } from '../src/games/catQuarters/Puzzles';

describe('Cat Quarters boards', () => {
  it.each(PUZZLES)('has exactly one solution for $name', ({ rows }) => {
    const size = rows.length;
    const regions = rows.join('');
    expect(rows.every(row => row.length === size)).toBe(true);
    expect(new Set(regions).size).toBe(size);

    const countSolutions = (cats: number[]): number => {
      if (cats.length === size) return 1;
      return Array.from({ length: size }, (_, col) => {
        const next = [...cats, cats.length * size + col];
        return findConflicts(regions, size, next).size ? 0 : countSolutions(next);
      }).reduce((total, count) => total + count, 0);
    };

    expect(countSolutions([])).toBe(1);
  });

  it('flags shared rows, columns, rooms and touching corners', () => {
    const regions = PUZZLES[0].rows.join('');
    for (const pair of [[0, 1], [0, 5], [1, 12], [0, 6]]) {
      expect(findConflicts(regions, 5, pair)).toEqual(new Set(pair));
    }
    expect(findConflicts(regions, 5, [0, 12]).size).toBe(0);
  });
});

describe('Cat Quarters play', () => {
  const game = new CatQuartersGame();

  afterEach(() => {
    game.destroy();
    document.body.replaceChildren();
  });

  function launch() {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    game.init(canvas);
    return canvas;
  }

  const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
  const tile = (index: number) => button(`.cq-tile[data-index="${index}"]`);
  const status = () => document.querySelector('.cq-status')!.textContent;

  it('marks, places, undoes, solves, and opens a fresh board', () => {
    launch();
    button('[data-tool="mark"]').click();
    tile(1).click();
    expect(tile(1).dataset.state).toBe('mark');
    button('[data-tool="cat"]').click();
    tile(0).click();
    tile(6).click();
    expect(tile(0).getAttribute('aria-label')).toContain('conflict');
    expect(status()).toContain('Check');
    button('.cq-undo').click();
    expect(tile(6).dataset.state).toBe('empty');
    expect(status()).toBe('1 of 5 cats placed');
    [7, 14, 16, 23].forEach(index => tile(index).click());
    expect(status()).toContain('Puzzle solved');
    expect(button('.cq-next').hidden).toBe(false);
    tile(0).click();
    expect(tile(0).dataset.state).toBe('cat');
    button('.cq-next').click();
    expect(status()).toBe('0 of 5 cats placed');
    expect(button('.cq-next').hidden).toBe(true);
    expect(document.activeElement).toBe(tile(0));
  });

  it('moves keyboard focus, pauses input, resets, and releases the canvas', () => {
    const canvas = launch();
    expect(canvas.classList.contains('hidden')).toBe(true);
    tile(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(tile(5));
    game.pause();
    tile(5).click();
    expect(tile(5).dataset.state).toBe('empty');
    const picker = document.querySelector<HTMLSelectElement>('#cq-puzzle')!;
    picker.selectedIndex = 2;
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    expect(picker.selectedIndex).toBe(0);
    expect(document.querySelectorAll('.cq-tile')).toHaveLength(25);
    game.resume();
    tile(5).click();
    expect(tile(5).dataset.state).toBe('cat');
    button('.cq-reset').click();
    expect(tile(5).dataset.state).toBe('empty');
    game.destroy();
    expect(canvas.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cat-quarters')).toBeNull();
  });

  it('picks a new puzzle size within the range and remembers it', () => {
    localStorage.removeItem('kipu-cat-quarters-size');
    launch();
    const value = () => document.querySelector('.cq-size-value')!.textContent;
    expect(value()).toBe('7 × 7');
    for (let i = 0; i < 8; i++) button('.cq-size-up').click();
    expect(value()).toBe('10 × 10');
    expect(button('.cq-size-up').disabled).toBe(true);
    for (let i = 0; i < 8; i++) button('.cq-size-down').click();
    expect(value()).toBe('5 × 5');
    expect(button('.cq-size-down').disabled).toBe(true);
    button('.cq-size-up').click();
    expect(localStorage.getItem('kipu-cat-quarters-size')).toBe('6');
    game.destroy();
    launch();
    expect(value()).toBe('6 × 6');
  });
});
