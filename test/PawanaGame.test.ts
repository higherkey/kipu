import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PawanaGame } from '../src/games/pawana/PawanaGame';

// Mock Audio & Haptics
vi.mock('../src/core/AudioController', () => ({
  AudioController: {
    getInstance: () => ({
      registerSound: vi.fn(),
      play: vi.fn(),
      updateMuteState: vi.fn(),
    })
  }
}));

vi.mock('../src/core/HapticController', () => ({
  HapticController: {
    getInstance: () => ({
      lightTap: vi.fn(),
      success: vi.fn(),
      mediumTap: vi.fn(),
    })
  }
}));

const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  roundRect: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fillText: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn(),
  }),
  setLineDash: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1.0,
};

describe('PawanaGame', () => {
  let canvas: HTMLCanvasElement;
  let game: PawanaGame;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext = vi.fn().mockReturnValue(mockCtx);

    // Provide a parent container for DOM overlay mounting
    const parent = document.createElement('div');
    parent.id = 'app';
    parent.appendChild(canvas);
    document.body.appendChild(parent);

    game = new PawanaGame();
  });

  afterEach(() => {
    game.destroy();
    document.body.innerHTML = '';
  });

  it('should initialize game, mount DOM overlay, and render menu state', () => {
    game.init(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect((game as any).state).toBe('menu');

    // Verify DOM overlay mounted
    const overlay = document.querySelector('.pawana-overlay-container');
    expect(overlay).not.toBeNull();

    // Verify title and buttons present
    const title = overlay?.querySelector('#pawana-modal-title');
    expect(title?.textContent).toBe('Pawana');

    const startBtn = overlay?.querySelector('#pawana-btn-start');
    expect(startBtn).not.toBeNull();
  });

  it('should start flight and spawn initial split-gates', () => {
    game.init(canvas);
    (game as any).startFlight();

    expect((game as any).state).toBe('playing');
    expect((game as any).gates.length).toBeGreaterThan(0);
    expect((game as any).hearts).toBe(3); // normal mode default
    expect((game as any).score).toBe(0);

    const firstGate = (game as any).gates[0];
    expect(firstGate.question).toBeDefined();
    expect(firstGate.topGapY).toBeGreaterThan(0);
    expect(firstGate.bottomGapY).toBeGreaterThan(firstGate.topGapY);
  });

  it('should apply difficulty settings correctly (hearts and speed)', () => {
    game.init(canvas);

    // Easy mode
    (game as any).currentDifficulty = 'easy';
    (game as any).startFlight();
    expect((game as any).hearts).toBe(5);
    expect((game as any).maxHearts).toBe(5);

    // Hard mode
    (game as any).currentDifficulty = 'hard';
    (game as any).startFlight();
    expect((game as any).hearts).toBe(2);
    expect((game as any).maxHearts).toBe(2);
  });

  it('should update physics and clamp delta-time properly', () => {
    game.init(canvas);
    (game as any).startFlight();

    const initialY = (game as any).flyerY;
    // Update with 16ms
    game.update(16);
    expect((game as any).flyerY).toBeGreaterThan(initialY); // Falling with gravity

    // Flap
    (game as any).flap();
    expect((game as any).flyerVy).toBeLessThan(0); // Upward impulse
  });

  it('should trigger bounded invulnerability and deduct heart on collision', () => {
    game.init(canvas);
    (game as any).startFlight();
    expect((game as any).hearts).toBe(3);
    expect((game as any).invulnerableTimer).toBe(0);

    // Trigger hit
    (game as any).takeHit('Test bump');
    expect((game as any).hearts).toBe(2);
    expect((game as any).invulnerableTimer).toBe(1500); // 1500ms bounded timer

    // Another hit during invulnerability should not deduct heart
    (game as any).takeHit('Subsequent bump in invulnerability');
    expect((game as any).hearts).toBe(2);
  });

  it('should pause and resume state cleanly', () => {
    game.init(canvas);
    (game as any).startFlight();

    game.pause();
    expect((game as any).state).toBe('paused');
    expect(document.getElementById('pawana-pause-overlay')).not.toBeNull();

    game.resume();
    expect((game as any).state).toBe('playing');
    expect(document.getElementById('pawana-pause-overlay')).toBeNull();
  });

  it('should manage wind gust warning lead-time and active state transitions', () => {
    game.init(canvas);
    (game as any).startFlight();

    const windGust = (game as any).windGust;
    expect(windGust).toBeDefined();
    expect(windGust.state).toBe('idle');

    // Fast-forward wind idle timer
    windGust.timer = 50;
    (game as any).updateWindGust(60);

    // Should enter warning state with lead time and visual indicator
    expect(windGust.state).toBe('warning');
    expect(windGust.warningDuration).toBe(2000);
    const indicator = document.getElementById('pawana-wind-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains('hidden')).toBe(false);
    expect(indicator?.textContent).toContain('Wind Gust Incoming');

    // Fast-forward warning duration into active gust
    windGust.timer = 50;
    (game as any).updateWindGust(60);

    // Should enter active state with force applied
    expect(windGust.state).toBe('active');
    expect(windGust.force).not.toBe(0);
    expect(indicator?.classList.contains('active')).toBe(true);
    expect(indicator?.textContent).toContain('Wayra Wind');

    // Verify draft force influences flyer physics in updatePhysics
    const initialVy = (game as any).flyerVy;
    (game as any).updatePhysics(1.0);
    expect((game as any).flyerVy).toBeCloseTo(initialVy + (game as any).gravity + windGust.force, 2);

    // Fast-forward active duration back to idle
    windGust.timer = 50;
    (game as any).updateWindGust(60);
    expect(windGust.state).toBe('idle');
    expect(windGust.force).toBe(0);
    expect(indicator?.classList.contains('hidden')).toBe(true);
  });

  it('should advance sky cycle progress based on game score', () => {
    game.init(canvas);
    (game as any).startFlight();

    expect((game as any).skyCycleProgress).toBe(0);

    // Increment score to 8 and update sky cycle
    (game as any).score = 8;
    (game as any).updateSkyCycle(1000);

    expect((game as any).skyCycleProgress).toBeGreaterThan(0);
    expect((game as any).skyCycleProgress).toBeLessThanOrEqual(8 / 15);
  });

  it('should cleanly remove listeners and tear down DOM overlay on destroy', () => {
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener');
    const canvasRemoveSpy = vi.spyOn(canvas, 'removeEventListener');

    game.init(canvas);
    expect(document.querySelector('.pawana-overlay-container')).not.toBeNull();

    game.destroy();

    expect(windowRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(canvasRemoveSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(document.querySelector('.pawana-overlay-container')).toBeNull();
  });
});
