import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToneGardenGame, PatternLoomGame, TrackSketcherGame } from '../src/games/musicExperiments/MusicExperiments';
import type { Game } from '../src/core/Game';

describe('Music experiments', () => {
  let canvas: HTMLCanvasElement;
  let game: Game;
  let oscillator: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.append(canvas);
    const context = Object.fromEntries(['fillRect', 'fillText', 'beginPath', 'roundRect', 'fill', 'arc', 'moveTo', 'lineTo', 'stroke', 'strokeRect'].map(key => [key, vi.fn()]));
    vi.spyOn(canvas, 'getContext').mockReturnValue(context as any);
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, width: canvas.width, height: canvas.height } as DOMRect));
    oscillator = vi.fn(() => ({ type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
    vi.stubGlobal('AudioContext', class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = oscillator;
      createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
      resume = () => Promise.resolve();
      suspend = () => Promise.resolve();
      close = () => Promise.resolve();
    });
    // Match the Web Audio connect chaining contract.
    oscillator.mockImplementation(() => ({ type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(gain => gain), start: vi.fn(), stop: vi.fn() }));
  });

  afterEach(() => {
    game?.destroy();
    canvas.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function tap(x: number, y: number) {
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y }));
  }

  it('hits the drawn bloom, ignores margins, and supports named button activation', () => {
    game = new ToneGardenGame();
    game.init(canvas);
    tap(5, 5);
    expect(oscillator).not.toHaveBeenCalled();
    tap(40, 100);
    expect(oscillator).toHaveBeenCalledTimes(1);
    const button = canvas.querySelector('button')!;
    expect(button.textContent).toBe('Air bloom 1');
    button.click();
    expect(oscillator).toHaveBeenCalledTimes(2);
  });

  it('honors persisted mute, sound toggles, pause, and listener teardown', () => {
    localStorage.setItem('soundEnabled', 'false');
    game = new ToneGardenGame();
    game.init(canvas);
    tap(40, 100);
    expect(oscillator).not.toHaveBeenCalled();
    game.setSoundEnabled!(true);
    game.pause!();
    tap(40, 100);
    expect(oscillator).not.toHaveBeenCalled();
    game.resume!();
    tap(40, 100);
    expect(oscillator).toHaveBeenCalledTimes(1);
    game.destroy();
    tap(40, 100);
    expect(oscillator).toHaveBeenCalledTimes(1);
  });

  it('toggles the second lane at its rendered position and preserves step timing remainder', () => {
    game = new PatternLoomGame();
    game.init(canvas);
    const button = canvas.children[16];
    expect(button.getAttribute('aria-pressed')).toBe('false');
    tap(40, 200);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    game.update(280);
    expect((game as any).step).toBe(1);
    game.update(276);
    expect((game as any).step).toBe(2);
    game.pause!();
    game.update(1000);
    expect((game as any).step).toBe(2);
  });

  it('keeps all steps reachable after a narrow resize', () => {
    game = new PatternLoomGame();
    game.init(canvas);
    game.resize!(360, 740);
    expect(canvas.children).toHaveLength(32);
    (canvas.children[31] as HTMLButtonElement).click();
    expect(canvas.children[31].getAttribute('aria-pressed')).toBe('true');
    expect((game as any).cells.every((cell: any) => cell.width >= 44 && cell.height >= 44)).toBe(true);
  });

  it.each(['null', '{}', '[null]', 'invalid', '[{"x":"bad","y":0.2}]'])('recovers from malformed saved notes: %s', saved => {
    localStorage.setItem('kipu-track-sketcher-v1', saved);
    game = new TrackSketcherGame();
    expect(() => game.init(canvas)).not.toThrow();
    expect((game as any).notes).toEqual([]);
  });

  it('persists notes and clearing, and survives unavailable storage', () => {
    game = new TrackSketcherGame();
    game.init(canvas);
    (canvas.children[1] as HTMLButtonElement).click();
    expect(oscillator.mock.results[0].value.frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 0);
    (canvas.children[0] as HTMLButtonElement).click();
    tap(100, 150);
    expect(JSON.parse(localStorage.getItem('kipu-track-sketcher-v1')!)).toHaveLength(1);
    game.destroy();
    game = new TrackSketcherGame();
    game.init(canvas);
    expect((game as any).notes).toHaveLength(1);
    (canvas.children[0] as HTMLButtonElement).click();
    expect(localStorage.getItem('kipu-track-sketcher-v1')).toBe('[]');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => tap(100, 150)).not.toThrow();
  });
});
