import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorDropperGame } from '../src/games/colorDropper/ColorDropperGame';
import { TranslationManager } from '../src/core/TranslationManager';

vi.mock('../src/core/AudioController', () => {
  return {
    AudioController: {
      getInstance: () => ({
        registerSound: vi.fn(),
        play: vi.fn(),
        speak: vi.fn(),
      })
    }
  };
});

vi.mock('../src/core/HapticController', () => {
  return {
    HapticController: {
      getInstance: () => ({
        lightTap: vi.fn(),
      })
    }
  };
});

const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  createRadialGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn()
  }),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 50 }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetY: 0,
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1.0
};

describe('ColorDropperGame', () => {
  let canvas: HTMLCanvasElement;
  let game: ColorDropperGame;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext = vi.fn().mockReturnValue(mockCtx);
    TranslationManager.getCurrent = vi.fn().mockReturnValue({ code: 'en-US' });

    game = new ColorDropperGame();
  });

  it('should initialize successfully and create color pots', () => {
    game.init(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    
    const pots = (game as any).pots;
    expect(pots).toHaveLength(3);
    expect(pots[0].labelKey).toBe('red');
    expect(pots[1].labelKey).toBe('yellow');
    expect(pots[2].labelKey).toBe('blue');
  });

  it('should spawn a color blob', () => {
    game.init(canvas);
    expect((game as any).blobs).toHaveLength(0);

    (game as any).spawnBlob('red', 100, 200);
    expect((game as any).blobs).toHaveLength(1);
    
    const blob = (game as any).blobs[0];
    expect(blob.colorName).toBe('red');
    expect(blob.components.red).toBe(1);
    expect(blob.components.yellow).toBe(0);
    expect(blob.components.blue).toBe(0);
  });

  it('should merge two primary blobs and announce the blended color name', () => {
    game.init(canvas);
    
    (game as any).spawnBlob('red', 200, 200);
    (game as any).spawnBlob('yellow', 210, 200);

    expect((game as any).blobs).toHaveLength(2);
    (game as any).checkBlobMerges();

    expect((game as any).blobs).toHaveLength(1);
    const merged = (game as any).blobs[0];
    expect(merged.colorName).toBe('orange');
    expect(merged.colorHex).toBe('rgb(255, 165, 0)');
    expect(merged.components.red).toBe(1);
    expect(merged.components.yellow).toBe(1);
  });

  it('should blend Red and Blue into vibrant purple (#9B59B6)', () => {
    game.init(canvas);

    (game as any).spawnBlob('red', 200, 200);
    (game as any).spawnBlob('blue', 210, 200);

    (game as any).checkBlobMerges();

    expect((game as any).blobs).toHaveLength(1);
    const merged = (game as any).blobs[0];
    expect(merged.colorName).toBe('purple');
    expect(merged.colorHex).toBe('rgb(155, 89, 182)');
  });

  it('should blend Yellow and Blue into vibrant green (#2ECC71)', () => {
    game.init(canvas);

    (game as any).spawnBlob('yellow', 200, 200);
    (game as any).spawnBlob('blue', 210, 200);

    (game as any).checkBlobMerges();

    expect((game as any).blobs).toHaveLength(1);
    const merged = (game as any).blobs[0];
    expect(merged.colorName).toBe('green');
    expect(merged.colorHex).toBe('rgb(46, 204, 113)');
  });

  it('should blend Red, Yellow, and Blue into warm brown (#8B5A2B)', () => {
    game.init(canvas);

    const result = (game as any).computeProgrammaticColor({ red: 1, yellow: 1, blue: 1 });
    expect(result.colorName).toBe('brown');
    expect(result.colorHex).toBe('rgb(139, 90, 43)');
  });

  it('should split a secondary blob back to its primaries with merge cooldowns', () => {
    game.init(canvas);

    const orangeBlob = {
      id: 99,
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 50,
      colorHex: 'rgb(255, 165, 0)',
      colorName: 'orange',
      components: { red: 1, yellow: 1, blue: 0 },
      isDragging: false,
      mergeCooldown: 0
    };
    (game as any).blobs.push(orangeBlob);

    expect((game as any).blobs).toHaveLength(1);
    (game as any).trySplitBlob(orangeBlob);

    expect((game as any).blobs).toHaveLength(2);
    const colors = (game as any).blobs.map((b: any) => b.colorName).sort();
    expect(colors).toEqual(['red', 'yellow']);

    (game as any).blobs.forEach((b: any) => {
      expect(b.mergeCooldown).toBe(800);
    });
  });

  it('should enforce entity cap limit and recycle drops on spawn', () => {
    game.init(canvas);
    (game as any).ENTITY_LIMIT = 3;

    (game as any).spawnBlob('red', 100, 100);
    (game as any).spawnBlob('yellow', 150, 100);
    (game as any).spawnBlob('blue', 200, 100);
    expect((game as any).blobs).toHaveLength(3);

    (game as any).spawnBlob('red', 250, 100);
    expect((game as any).blobs).toHaveLength(3);

    const ids = (game as any).blobs.map((b: any) => b.id);
    expect(ids).not.toContain(1);
    expect(ids).toContain(4);
  });

  it('should enforce entity limit when splitting large multi-component blobs', () => {
    game.init(canvas);
    (game as any).ENTITY_LIMIT = 5;

    // Fill with 4 existing drops
    (game as any).spawnBlob('red', 100, 100);
    (game as any).spawnBlob('yellow', 150, 100);
    (game as any).spawnBlob('blue', 200, 100);
    (game as any).spawnBlob('red', 250, 100);
    expect((game as any).blobs).toHaveLength(4);

    // Multi-component drop with 10 units
    const multiBlob = {
      id: 99,
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 60,
      colorHex: 'rgb(139, 90, 43)',
      colorName: 'brown',
      components: { red: 4, yellow: 3, blue: 3 },
      isDragging: false,
      mergeCooldown: 0
    };
    (game as any).blobs.push(multiBlob);
    expect((game as any).blobs).toHaveLength(5);

    // Split should not exceed ENTITY_LIMIT (5)
    (game as any).trySplitBlob(multiBlob);
    expect((game as any).blobs.length).toBeLessThanOrEqual(5);
  });

  it('should recalculate dragOffset smoothly when dragged blob merges', () => {
    game.init(canvas);

    (game as any).spawnBlob('red', 200, 200);
    (game as any).spawnBlob('blue', 210, 200);

    const b1 = (game as any).blobs[0];
    const b2 = (game as any).blobs[1];

    // Simulate b2 being dragged with cursor at (220, 205)
    b2.isDragging = true;
    (game as any).draggingBlob = b2;
    (game as any).dragOffset = { x: 220 - b2.x, y: 205 - b2.y };

    (game as any).checkBlobMerges();

    // Merged blob becomes b1 and inherits dragging state
    expect((game as any).blobs).toHaveLength(1);
    const merged = (game as any).blobs[0];
    expect(merged.isDragging).toBe(true);
    expect((game as any).draggingBlob).toBe(merged);

    // dragOffset must equal (cursorPos - mergedPos) so movePress(220, 205) yields no jump
    const expectedOffsetX = 220 - merged.x;
    const expectedOffsetY = 205 - merged.y;
    expect((game as any).dragOffset.x).toBeCloseTo(expectedOffsetX, 5);
    expect((game as any).dragOffset.y).toBeCloseTo(expectedOffsetY, 5);
  });

  it('should apply framerate-independent physics damping based on delta time', () => {
    game.init(canvas);

    (game as any).spawnBlob('red', 300, 300);
    const blob = (game as any).blobs[0];
    blob.vx = 100;
    blob.vy = 0;

    // Simulate 16.66ms frame (approx 60 FPS -> decay ~0.98)
    game.update(16.666);
    expect(blob.vx).toBeCloseTo(100 * 0.98, 1);
  });

  it('should reposition pots and bound blobs on resize', () => {
    game.init(canvas);
    (game as any).spawnBlob('red', 700, 500);

    // Resize to smaller landscape viewport
    game.resize(600, 400);

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(400);

    // Pots must be re-spaced across 600px width
    const pots = (game as any).pots;
    expect(pots[2].x + pots[2].width).toBeLessThanOrEqual(600);

    // Blobs must be clamped within 600x400
    const blob = (game as any).blobs[0];
    expect(blob.x).toBeLessThanOrEqual(600 - blob.radius);
    expect(blob.y).toBeLessThanOrEqual(400 - blob.radius);
  });

  it('should clean up event listeners on destroy', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    game.init(canvas);
    game.destroy();
    
    expect(removeSpy).toHaveBeenCalled();
  });
});
