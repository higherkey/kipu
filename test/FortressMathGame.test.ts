import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FortressMathGame } from '../src/games/fortressMath/FortressMathGame';

describe('Fortress Math integration', () => {
  let game: FortressMathGame;
  let canvas: HTMLCanvasElement;
  const root = () => document.getElementById('fortress-math-game')!;
  const button = (selector: string) => root().querySelector<HTMLButtonElement>(selector)!;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><canvas id="game-canvas"></canvas></div>';
    canvas = document.querySelector('canvas')!;
    game = new FortressMathGame();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
    document.body.innerHTML = '';
  });

  it('mounts twelve native region buttons without inline styling', () => {
    expect(root().querySelectorAll('button[data-region]')).toHaveLength(12);
    expect(root().querySelector('[style]')).toBeNull();
    expect(button('[data-region="0"]').getAttribute('aria-label')).toContain('Neighbors Clover Field, Willow Wood');
    expect(canvas.classList.contains('hidden')).toBe(true);
  });

  it('captures a neighboring region through the real interface', () => {
    button('[data-region="1"]').click();
    const input = root().querySelector<HTMLInputElement>('#fortress-amount')!;
    input.value = '6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button('[data-action="capture"]').click();
    expect((game as any).state.regions[1].owner).toBe(0);
    expect((game as any).state.reserves[0]).toBe(2);
  });

  it('bots advance automatically, respect pause, and return control to the child', () => {
    button('[data-action="end-turn"]').click();
    const snapshot = JSON.stringify((game as any).state);
    game.pause();
    for (let i = 0; i < 20; i++) game.update(1000);
    expect(JSON.stringify((game as any).state)).toBe(snapshot);
    game.resume();
    for (let i = 0; i < 20 && (game as any).state.turn !== 0; i++) game.update(1000);
    expect((game as any).state.turn).toBe(0);
    expect((game as any).state.round).toBe(2);
    expect(JSON.stringify((game as any).state)).not.toBe(snapshot);
  });

  it('keeps reserves and actions when an answer is too small', () => {
    button('[data-region="1"]').click();
    const snapshot = JSON.stringify((game as any).state);
    button('[data-action="capture"]').click();
    expect(JSON.stringify((game as any).state)).toBe(snapshot);
    expect(root().textContent).toContain('Too few');
    const input = root().querySelector<HTMLInputElement>('#fortress-amount')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('explains when a neighboring region costs more than the available reserve', () => {
    (game as any).state.reserves[0] = 1;
    button('[data-region="1"]').click();
    expect(button('[data-action="capture"]').disabled).toBe(true);
    expect(root().querySelector('#fortress-preview')?.textContent).toContain('need at least 3');
    expect(root().querySelector('#fortress-preview')?.textContent).toContain('have 1');
    expect(document.activeElement).toBe(button('[data-region="1"]'));
    expect(root().querySelector('[role="status"]')?.textContent).toContain('have 1');
  });

  it('announces the maximum number of explorers who stay in a capture', () => {
    (game as any).state.reserves[0] = 12;
    button('[data-region="1"]').click();
    const input = root().querySelector<HTMLInputElement>('#fortress-amount')!;
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const preview = root().querySelector('#fortress-preview');
    expect(preview?.getAttribute('aria-live')).toBe('polite');
    expect(preview?.textContent).toContain('10 left. 8 will stay here');
  });

  it('restores keyboard focus after capture and keeps help focused during bot updates', () => {
    button('[data-region="1"]').click();
    const input = root().querySelector<HTMLInputElement>('#fortress-amount')!;
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button('[data-action="capture"]').focus();
    button('[data-action="capture"]').click();
    expect(document.activeElement).not.toBe(document.body);
    button('[data-action="end-turn"]').click();
    const help = root().querySelector<HTMLElement>('#fortress-help')!;
    help.focus();
    game.update(1000);
    expect(document.activeElement?.id).toBe('fortress-help');
  });

  it('offers a fresh game after a victory', () => {
    (game as any).state.winner = 0;
    (game as any).render();
    button('[data-action="restart"]').click();
    expect((game as any).state.winner).toBeNull();
    expect((game as any).state.round).toBe(1);
    expect((game as any).state.reserves).toEqual([8, 8, 8]);
  });

  it('tears down its UI and restores the shared canvas', () => {
    game.destroy();
    expect(document.getElementById('fortress-math-game')).toBeNull();
    expect(canvas.classList.contains('hidden')).toBe(false);
    expect(() => game.update(1000)).not.toThrow();
  });
});
