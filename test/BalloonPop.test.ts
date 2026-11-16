import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BalloonPopGame } from '../src/games/balloonPop/BalloonPopGame';
import { AudioController } from '../src/core/AudioController';
import { HapticController } from '../src/core/HapticController';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;

  const ctx: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
  };

  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
  });
  return canvas;
}

describe('BalloonPopGame', () => {
  let game: BalloonPopGame;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    vi.spyOn(HapticController.prototype, 'lightTap').mockImplementation(() => {});
    vi.spyOn(HapticController.prototype, 'heavyImpact').mockImplementation(() => {});

    game = new BalloonPopGame();
    canvas = createMockCanvas();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
  });

  it('should initialize game state cleanly', () => {
    expect(game).toBeDefined();
    expect((game as any).balloons.length).toBe(0);
    expect((game as any).popsCount).toBe(0);
  });

  it('should spawn balloons on update cycle', () => {
    game.update(1600); // Exceeds initial 1500ms spawn interval
    expect((game as any).balloons.length).toBeGreaterThan(0);
  });

  it('should handle popping a balloon on touch/mouse hit', () => {
    (game as any).balloons = [
      { x: 100, y: 100, radius: 40, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 1, velocity: 2 }
    ];

    (game as any).checkPop(100, 100);

    expect((game as any).popsCount).toBe(1);
    expect((game as any).balloons.length).toBe(0);
  });

  it('should handle multi-hit balloons correctly before popping', () => {
    (game as any).balloons = [
      { x: 200, y: 200, radius: 40, color: '#FFE66D', pattern: 'dots', hits: 0, maxHits: 2, velocity: 2 }
    ];

    // First hit
    (game as any).checkPop(200, 200);
    expect((game as any).balloons.length).toBe(1);
    expect((game as any).balloons[0].hits).toBe(1);

    // Second hit -> pops balloon
    (game as any).checkPop(200, 200);
    expect((game as any).balloons.length).toBe(0);
    expect((game as any).popsCount).toBe(1);
  });

  it('should remove event listeners on destroy', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    game.destroy();
    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });

  // Targeted Defect Resolution Tests:
  it('should render dots deterministically without per-frame Math.random jitter', () => {
    (game as any).balloons = [
      { x: 300, y: 300, radius: 50, color: '#FFE66D', pattern: 'dots', hits: 0, maxHits: 3, velocity: 2 }
    ];

    // First render generates or uses deterministic dots
    (game as any).render();
    const dotsSnapshot1 = JSON.stringify((game as any).balloons[0].dots);

    // Spy on Math.random during render
    const randomSpy = vi.spyOn(Math, 'random');
    (game as any).render();

    // Zero Math.random calls during render!
    expect(randomSpy).not.toHaveBeenCalled();

    const dotsSnapshot2 = JSON.stringify((game as any).balloons[0].dots);
    // Dot positions must be identical across frames
    expect(dotsSnapshot1).toBe(dotsSnapshot2);
  });

  it('should keep dots strictly within balloon circular radius', () => {
    const dots = (game as any).generateBalloonDots();
    expect(dots.length).toBeGreaterThan(10);
    for (const dot of dots) {
      const dist = Math.hypot(dot.dx, dot.dy);
      // Normalized distance must be <= 0.75
      expect(dist).toBeLessThanOrEqual(0.75);
    }
  });

  it('should pause and resume balloon movement and spawning cleanly', () => {
    (game as any).balloons = [
      { x: 200, y: 400, radius: 40, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 1, velocity: 2 }
    ];

    game.pause();
    expect((game as any).isPaused).toBe(true);

    // Update while paused
    game.update(2000);
    // Balloon must not move while paused
    expect((game as any).balloons[0].y).toBe(400);
    // No new balloons should spawn while paused
    expect((game as any).balloons.length).toBe(1);

    // Input must be ignored while paused
    (game as any).checkPop(200, 400);
    expect((game as any).balloons.length).toBe(1);

    game.resume();
    expect((game as any).isPaused).toBe(false);

    // Update after resume
    game.update(16);
    expect((game as any).balloons[0].y).toBeLessThan(400);
  });

  it('should adjust balloons to stay within visible bounds on resize', () => {
    (game as any).balloons = [
      { x: 780, y: 300, radius: 40, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 1, velocity: 2 }
    ];

    game.resize(400, 300);

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
    expect((game as any).balloons[0].x).toBeLessThanOrEqual(400 - 40);
  });

  it('should support pointerdown and prevent default to eliminate mobile scroll conflict', () => {
    (game as any).balloons = [
      { x: 150, y: 150, radius: 40, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 1, velocity: 2 }
    ];

    const pointerEv = new Event('pointerdown', { cancelable: true });
    (pointerEv as any).clientX = 150;
    (pointerEv as any).clientY = 150;
    canvas.dispatchEvent(pointerEv);

    expect(pointerEv.defaultPrevented).toBe(true);
    expect((game as any).popsCount).toBe(1);
    expect((game as any).balloons.length).toBe(0);
  });
});
