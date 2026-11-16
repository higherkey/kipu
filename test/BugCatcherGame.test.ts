import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BugCatcherGame } from '../src/games/bugCatcher/BugCatcherGame';
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
    font: '',
    textAlign: '',
    textBaseline: '',
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    createImageData: vi.fn().mockImplementation((w, h) => ({
      data: new Uint8ClampedArray(w * h * 4),
    })),
    putImageData: vi.fn(),
    createPattern: vi.fn().mockReturnValue({}),
    drawImage: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
  });

  return canvas;
}

describe('BugCatcherGame', () => {
  let game: BugCatcherGame;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    vi.spyOn(HapticController.prototype, 'lightTap').mockImplementation(() => {});

    game = new BugCatcherGame();
    canvas = createMockCanvas();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
  });

  it('should initialize 4 bugs at start', () => {
    expect(game).toBeDefined();
    expect((game as any).bugs.length).toBe(4);
    expect((game as any).bugsCaught).toBe(0);
  });

  it('should catch a bug when clicked', () => {
    const bugs = (game as any).bugs;
    bugs[0].x = 200; bugs[0].y = 200;
    bugs[1].x = 500; bugs[1].y = 200;
    bugs[2].x = 200; bugs[2].y = 400;
    bugs[3].x = 500; bugs[3].y = 400;
    const target = bugs[0];

    (game as any).checkBugClick(target.x, target.y);

    expect(target.caught).toBe(true);
    expect((game as any).bugsCaught).toBe(1);
  });

  it('should trigger win condition when all 4 bugs are caught and reset on subsequent tap', () => {
    const bugs = (game as any).bugs;
    bugs.forEach((b: any) => (game as any).checkBugClick(b.x, b.y));

    expect((game as any).bugsCaught).toBe(4);

    // Tap anywhere while on win screen
    (game as any).checkBugClick(100, 100);

    // Should have reset
    expect((game as any).bugsCaught).toBe(0);
    expect((game as any).bugs.length).toBe(4);
    expect((game as any).bugs.every((b: any) => !b.caught)).toBe(true);
  });

  it('should update texture phase animation', () => {
    const initialPhase = (game as any).texturePhase;
    game.update(16);
    expect((game as any).texturePhase).toBeGreaterThan(initialPhase);
  });

  it('should not allocate per-frame full-screen ImageData in update/render', () => {
    const ctx = canvas.getContext('2d') as any;
    const initialCallCount = ctx.createImageData.mock.calls.length;

    // Run 10 consecutive frames
    for (let f = 0; f < 10; f++) {
      game.update(16);
    }

    // createImageData must not be called repeatedly during game loop
    const frameCallCount = ctx.createImageData.mock.calls.length - initialCallCount;
    expect(frameCallCount).toBe(0);
  });

  it('should scale and bound bugs within visible viewport on resize', () => {
    const bugs = (game as any).bugs;
    bugs[0].x = 750; bugs[0].y = 550;

    game.resize(500, 400);

    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(400);

    // Bugs must remain inside bounds (120 <= x <= 500 - 120, etc.)
    bugs.forEach((b: any) => {
      expect(b.x).toBeLessThanOrEqual(500 - 120);
      expect(b.x).toBeGreaterThanOrEqual(120);
      expect(b.y).toBeLessThanOrEqual(400 - 120);
      expect(b.y).toBeGreaterThanOrEqual(120);
    });
  });

  it('should remove event listeners on destroy', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    game.destroy();
    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
  });
});
