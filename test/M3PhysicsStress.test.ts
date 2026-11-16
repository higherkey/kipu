import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorDropperGame } from '../src/games/colorDropper/ColorDropperGame';
import { BugCatcherGame } from '../src/games/bugCatcher/BugCatcherGame';
import { TranslationManager } from '../src/core/TranslationManager';
import { AudioController } from '../src/core/AudioController';
import { HapticController } from '../src/core/HapticController';

// --- Color Conversion Helpers for Stress Testing ---

function parseRgb(rgbStr: string): [number, number, number] {
  const match = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) throw new Error(`Invalid rgb string: ${rgbStr}`);
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : (delta / (1 - Math.abs(2 * l - 1))) * 100;
  return { h, s, l: l * 100 };
}

// --- Mock Canvas Setup ---

function createMockCanvas(width = 800, height = 600): { canvas: HTMLCanvasElement; ctx: any } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

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
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    createImageData: vi.fn().mockImplementation((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    createPattern: vi.fn().mockReturnValue({ __brand: 'CanvasPatternMock' }),
    drawImage: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  return { canvas, ctx };
}

describe('M3 Adversarial Challenge: Physics, Mixing Math, Caps & Noise Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    vi.spyOn(AudioController.prototype, 'registerSound').mockImplementation(() => {});
    vi.spyOn(AudioController.prototype, 'speak').mockImplementation(() => {});
    vi.spyOn(HapticController.prototype, 'lightTap').mockImplementation(() => {});
    TranslationManager.getCurrent = vi.fn().mockReturnValue({ code: 'en-US' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Mandate 1: Subtractive RYB Mathematical Accuracy
  // =========================================================================
  describe('Mandate 1: Subtractive RYB Mathematical Accuracy (ColorDropper)', () => {
    let game: ColorDropperGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      game = new ColorDropperGame();
      const mock = createMockCanvas(800, 600);
      canvas = mock.canvas;
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('1.1: Pure Red + Pure Blue blends to Vibrant Purple (hue 270°-310°, saturation >= 40%, not muddy grey)', () => {
      const result = (game as any).computeProgrammaticColor({ red: 1, yellow: 0, blue: 1 });
      const [r, g, b] = parseRgb(result.colorHex);

      const hsv = rgbToHsv(r, g, b);
      const hsl = rgbToHsl(r, g, b);

      expect(result.colorName).toBe('purple');
      // Subtractive primary mixing: Amethyst Purple
      expect(result.colorHex).toBe('rgb(155, 89, 182)');

      // Hue must be strictly in the purple/violet gamut [270°, 310°]
      expect(hsv.h).toBeGreaterThanOrEqual(270);
      expect(hsv.h).toBeLessThanOrEqual(310);

      // Saturation must be vibrant (HSV saturation >= 40%, not muddy grey)
      expect(hsv.s).toBeGreaterThanOrEqual(40);
      // HSL saturation should also be healthy (~38.9%), compared to muddy grey which was ~10%
      expect(hsl.s).toBeGreaterThanOrEqual(35);

      // Contrast against naive additive RGB: Red(255,94,94) + Blue(78,205,196) additive average
      // was (166, 149, 145) with delta=21 and saturation < 13% (muddy pink-grey).
      const additiveR = Math.round((255 + 78) / 2);
      const additiveG = Math.round((94 + 205) / 2);
      const additiveB = Math.round((94 + 196) / 2);
      const additiveHsv = rgbToHsv(additiveR, additiveG, additiveB);
      expect(additiveHsv.s).toBeLessThan(15); // Demonstrates additive failure
      expect(hsv.s).toBeGreaterThan(additiveHsv.s * 3); // RYB is >3x more saturated
    });

    it('1.2: Pure Yellow + Pure Blue blends to Vibrant Green (hue 100°-150°, saturation >= 40%)', () => {
      const result = (game as any).computeProgrammaticColor({ red: 0, yellow: 1, blue: 1 });
      const [r, g, b] = parseRgb(result.colorHex);

      const hsv = rgbToHsv(r, g, b);
      const hsl = rgbToHsl(r, g, b);

      expect(result.colorName).toBe('green');
      expect(result.colorHex).toBe('rgb(46, 204, 113)');

      // Hue must be in the vibrant green gamut [100°, 150°]
      expect(hsv.h).toBeGreaterThanOrEqual(100);
      expect(hsv.h).toBeLessThanOrEqual(150);

      // Saturation >= 40% (both HSV and HSL)
      expect(hsv.s).toBeGreaterThanOrEqual(40);
      expect(hsl.s).toBeGreaterThanOrEqual(40);
    });

    it('1.3: Pure Red + Pure Yellow blends to Warm Orange (hue 25°-45°, saturation >= 70%)', () => {
      const result = (game as any).computeProgrammaticColor({ red: 1, yellow: 1, blue: 0 });
      const [r, g, b] = parseRgb(result.colorHex);

      const hsv = rgbToHsv(r, g, b);
      const hsl = rgbToHsl(r, g, b);

      expect(result.colorName).toBe('orange');
      expect(result.colorHex).toBe('rgb(255, 165, 0)');

      // Hue must be in the warm orange gamut [25°, 45°]
      expect(hsv.h).toBeGreaterThanOrEqual(25);
      expect(hsv.h).toBeLessThanOrEqual(45);

      // Saturation must be >= 70%
      expect(hsv.s).toBeGreaterThanOrEqual(70);
      expect(hsl.s).toBeGreaterThanOrEqual(70);
    });

    it('1.4: Multi-pigment mixing (Red + Yellow + Blue) blends to Rich Brown', () => {
      const result = (game as any).computeProgrammaticColor({ red: 1, yellow: 1, blue: 1 });
      const [r, g, b] = parseRgb(result.colorHex);

      expect(result.colorName).toBe('brown');
      expect(result.colorHex).toBe('rgb(139, 90, 43)');

      const hsv = rgbToHsv(r, g, b);
      // Warm earth tone hue [20°, 40°]
      expect(hsv.h).toBeGreaterThanOrEqual(20);
      expect(hsv.h).toBeLessThanOrEqual(40);
      // Value represents dark rich earth pigment
      expect(hsv.v).toBeLessThan(60);
      expect(hsv.v).toBeGreaterThan(30);
    });

    it('1.5: Asymmetric pigment ratios smoothly interpolate along artist color wheel', () => {
      // 3 Red + 1 Blue -> Magenta / Red-Violet
      const redViolet = (game as any).computeProgrammaticColor({ red: 3, yellow: 0, blue: 1 });
      const rvRgb = parseRgb(redViolet.colorHex);
      const rvHsv = rgbToHsv(rvRgb[0], rvRgb[1], rvRgb[2]);
      expect(rvHsv.h).toBeGreaterThanOrEqual(280);
      expect(rvHsv.h).toBeLessThanOrEqual(360);

      // 1 Red + 3 Blue -> Indigo / Blue-Violet
      const blueViolet = (game as any).computeProgrammaticColor({ red: 1, yellow: 0, blue: 3 });
      const bvRgb = parseRgb(blueViolet.colorHex);
      const bvHsv = rgbToHsv(bvRgb[0], bvRgb[1], bvRgb[2]);
      expect(bvHsv.h).toBeGreaterThanOrEqual(200);
      expect(bvHsv.h).toBeLessThanOrEqual(285);

      // 3 Yellow + 1 Blue -> Lime / Yellow-Green
      const yellowGreen = (game as any).computeProgrammaticColor({ red: 0, yellow: 3, blue: 1 });
      const ygRgb = parseRgb(yellowGreen.colorHex);
      const ygHsv = rgbToHsv(ygRgb[0], ygRgb[1], ygRgb[2]);
      expect(ygHsv.h).toBeGreaterThanOrEqual(90);
      expect(ygHsv.h).toBeLessThanOrEqual(140);

      // Neutral core with excess primary (Red: 3, Yellow: 1, Blue: 1)
      const redBrown = (game as any).computeProgrammaticColor({ red: 3, yellow: 1, blue: 1 });
      expect(redBrown.colorName).toBe('brown');
    });

    it('1.6: Zero-component fallback returns safe default without throwing', () => {
      const fallback = (game as any).computeProgrammaticColor({ red: 0, yellow: 0, blue: 0 });
      expect(fallback.colorName).toBe('red');
      expect(fallback.colorHex).toBe('#FF5E5E');
    });
  });

  // =========================================================================
  // Mandate 2: Hard Entity Limit (150 drops) Enforcement
  // =========================================================================
  describe('Mandate 2: Hard Entity Limit (150 drops) Enforcement (ColorDropper)', () => {
    let game: ColorDropperGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      game = new ColorDropperGame();
      const mock = createMockCanvas(800, 600);
      canvas = mock.canvas;
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('2.1: Spawning 149 drops then splitting a multi-pigment drop never exceeds 150 cap', () => {
      // Pre-fill to 149 drops
      for (let i = 0; i < 149; i++) {
        (game as any).spawnBlob(i % 2 === 0 ? 'red' : 'yellow', 100 + (i % 10) * 20, 200 + (i % 5) * 20);
      }
      expect((game as any).blobs).toHaveLength(149);

      // Create a 50-component drop and add it
      const massiveBlob = {
        id: 9999,
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        radius: 60,
        colorHex: 'rgb(139, 90, 43)',
        colorName: 'brown',
        components: { red: 25, yellow: 15, blue: 10 },
        isDragging: false,
        mergeCooldown: 0,
      };

      // Spawning / adding the 150th drop
      (game as any).blobs.push(massiveBlob);
      expect((game as any).blobs).toHaveLength(150);

      // Trigger massive split
      (game as any).trySplitBlob(massiveBlob);

      // Under NO circumstances can drop count exceed 150
      expect((game as any).blobs.length).toBeLessThanOrEqual(150);
      expect((game as any).blobs.length).toBe(150);
    });

    it('2.2: Extreme split stress test: 200-component drop with existing drops strictly adheres to 150 cap', () => {
      // Populate 100 drops
      for (let i = 0; i < 100; i++) {
        (game as any).spawnBlob('blue', 150, 250);
      }
      expect((game as any).blobs).toHaveLength(100);

      const extremeBlob = {
        id: 8888,
        x: 400,
        y: 350,
        vx: 0,
        vy: 0,
        radius: 80,
        colorHex: 'rgb(139, 90, 43)',
        colorName: 'brown',
        components: { red: 100, yellow: 50, blue: 50 }, // 200 components!
        isDragging: false,
        mergeCooldown: 0,
      };
      (game as any).blobs.push(extremeBlob);

      // Trigger split of 200 components
      (game as any).trySplitBlob(extremeBlob);

      expect((game as any).blobs.length).toBeLessThanOrEqual(150);
      expect((game as any).blobs.length).toBe(150);
    });

    it('2.3: Cascading rapid slicing across multiple high-component drops preserves 150 cap at every tick', () => {
      // Create 15 multi-component drops (each 10 components)
      (game as any).blobs = [];
      for (let i = 0; i < 15; i++) {
        (game as any).blobs.push({
          id: 1000 + i,
          x: 100 + i * 20,
          y: 200,
          vx: 0,
          vy: 0,
          radius: 50,
          colorHex: 'rgb(255, 165, 0)',
          colorName: 'orange',
          components: { red: 5, yellow: 5, blue: 0 },
          isDragging: false,
          mergeCooldown: 0,
        });
      }

      // Rapidly slice/split all drops in succession
      for (let step = 0; step < 15; step++) {
        const splittable = (game as any).blobs.find(
          (b: any) => b.components.red + b.components.yellow + b.components.blue > 1
        );
        if (splittable) {
          (game as any).trySplitBlob(splittable);
        }
        // Invariant check: cap is never breached at ANY step
        expect((game as any).blobs.length).toBeLessThanOrEqual(150);
      }
    });

    it('2.4: Active dragging drop is immune to recycling during cap-enforced splits', () => {
      // Fill to 149 drops
      for (let i = 0; i < 149; i++) {
        (game as any).spawnBlob('red', 200, 200);
      }

      // Mark one drop as actively held by player
      const userHeldDrop = (game as any).blobs[50];
      userHeldDrop.isDragging = true;
      (game as any).draggingBlob = userHeldDrop;

      // Add a 20-component blob and split it
      const multiBlob = {
        id: 7777,
        x: 350,
        y: 350,
        vx: 0,
        vy: 0,
        radius: 50,
        colorHex: 'rgb(46, 204, 113)',
        colorName: 'green',
        components: { red: 0, yellow: 10, blue: 10 },
        isDragging: false,
        mergeCooldown: 0,
      };
      (game as any).blobs.push(multiBlob);

      (game as any).trySplitBlob(multiBlob);

      // Verify cap enforced
      expect((game as any).blobs.length).toBeLessThanOrEqual(150);

      // User held drop MUST NOT have been recycled
      const heldFound = (game as any).blobs.some((b: any) => b.id === userHeldDrop.id);
      expect(heldFound).toBe(true);
    });

    it('2.5: Overflow spawns beyond 150 strictly recycle un-dragged entities', () => {
      // Spawn 160 drops sequentially
      for (let i = 0; i < 160; i++) {
        (game as any).spawnBlob('yellow', 200, 200);
      }

      expect((game as any).blobs).toHaveLength(150);
    });
  });

  // =========================================================================
  // Mandate 3: In-Flight Drag Merge Offset Stability
  // =========================================================================
  describe('Mandate 3: In-Flight Drag Merge Offset Stability (ColorDropper)', () => {
    let game: ColorDropperGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      game = new ColorDropperGame();
      const mock = createMockCanvas(800, 600);
      canvas = mock.canvas;
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('3.1: Dragging drop A into stationary drop B preserves drag offset with zero positional jump', () => {
      // Spawn drop A (red) at (300, 300) and drop B (blue) at (350, 300)
      (game as any).spawnBlob('red', 300, 300);
      (game as any).spawnBlob('blue', 350, 300);

      const blobA = (game as any).blobs[0];
      const blobB = (game as any).blobs[1];

      // Simulate pointerdown on blob A at cursor position (315, 310)
      const cursorX = 315;
      const cursorY = 310;
      (game as any).draggingBlob = blobA;
      blobA.isDragging = true;
      (game as any).dragOffset = { x: cursorX - blobA.x, y: cursorY - blobA.y }; // (15, 10)

      // Move cursor to (335, 310) -> blob A moves toward blob B
      const newCursorX = 335;
      const newCursorY = 310;
      (game as any).movePress(newCursorX, newCursorY);

      // Blob A position is now (335 - 15, 310 - 10) = (320, 300)
      expect(blobA.x).toBe(320);
      expect(blobA.y).toBe(300);

      // Distance to B is |350 - 320| = 30px, below merge threshold ((45+45)*0.85 = 76.5px)
      (game as any).checkBlobMerges();

      // Merged blob becomes blobs[0]
      expect((game as any).blobs).toHaveLength(1);
      const merged = (game as any).blobs[0];

      // Merged center of mass: (320 + 350) / 2 = 335
      expect(merged.x).toBeCloseTo(335, 2);
      expect(merged.y).toBeCloseTo(300, 2);

      // Merged blob must retain dragging state
      expect(merged.isDragging).toBe(true);
      expect((game as any).draggingBlob).toBe(merged);

      // CRITICAL: dragOffset must be updated so that:
      // (newCursor - dragOffset) === merged.position
      const currentOffset = (game as any).dragOffset;
      expect(newCursorX - currentOffset.x).toBeCloseTo(merged.x, 2);
      expect(newCursorY - currentOffset.y).toBeCloseTo(merged.y, 2);

      // Zero-jump assertion: Calling movePress with the SAME cursor position causes 0px delta!
      const preMoveX = merged.x;
      const preMoveY = merged.y;
      (game as any).movePress(newCursorX, newCursorY);
      expect(merged.x).toBe(preMoveX);
      expect(merged.y).toBe(preMoveY);

      // Follow-through drag assertion: Moving cursor by (+40, +25) moves merged drop by exactly (+40, +25)
      (game as any).movePress(newCursorX + 40, newCursorY + 25);
      expect(merged.x).toBeCloseTo(preMoveX + 40, 2);
      expect(merged.y).toBeCloseTo(preMoveY + 25, 2);
    });

    it('3.2: Inverse drag: Dragging drop B (second in array) into drop A preserves continuity', () => {
      (game as any).spawnBlob('yellow', 200, 200);
      (game as any).spawnBlob('blue', 250, 200);

      const blobA = (game as any).blobs[0];
      const blobB = (game as any).blobs[1];

      // Pointer down on blob B at (255, 205)
      const cursorX = 255;
      const cursorY = 205;
      (game as any).draggingBlob = blobB;
      blobB.isDragging = true;
      (game as any).dragOffset = { x: cursorX - blobB.x, y: cursorY - blobB.y }; // (5, 5)

      // Drag B toward A
      const targetCursorX = 230;
      const targetCursorY = 205;
      (game as any).movePress(targetCursorX, targetCursorY);

      expect(blobB.x).toBe(225);
      expect(blobB.y).toBe(200);

      // Trigger merge
      (game as any).checkBlobMerges();

      expect((game as any).blobs).toHaveLength(1);
      const merged = (game as any).blobs[0];
      expect(merged.isDragging).toBe(true);

      // Offset continuity
      const currentOffset = (game as any).dragOffset;
      expect(targetCursorX - currentOffset.x).toBeCloseTo(merged.x, 2);
      expect(targetCursorY - currentOffset.y).toBeCloseTo(merged.y, 2);

      // Verify zero jump
      (game as any).movePress(targetCursorX, targetCursorY);
      expect(merged.x).toBeCloseTo((200 + 225) / 2, 2);
    });

    it('3.3: Consecutive chained in-flight merges maintain offset stability across multiple collisions', () => {
      // 3 drops along horizontal line
      (game as any).spawnBlob('red', 200, 300);
      (game as any).spawnBlob('yellow', 240, 300);
      (game as any).spawnBlob('blue', 280, 300);

      // Drag first drop
      let cursorX = 205;
      let cursorY = 300;
      const b1 = (game as any).blobs[0];
      b1.isDragging = true;
      (game as any).draggingBlob = b1;
      (game as any).dragOffset = { x: 5, y: 0 };

      // Drag toward second drop -> merge 1
      cursorX = 235;
      (game as any).movePress(cursorX, cursorY);
      (game as any).checkBlobMerges();
      expect((game as any).blobs).toHaveLength(2);

      let activeDrop = (game as any).draggingBlob;
      expect(activeDrop.isDragging).toBe(true);
      expect(cursorX - (game as any).dragOffset.x).toBeCloseTo(activeDrop.x, 2);

      // Re-zero cooldowns for chained merge test
      (game as any).blobs.forEach((b: any) => { b.mergeCooldown = 0; });

      // Continue dragging toward third drop -> merge 2
      cursorX = 275;
      (game as any).movePress(cursorX, cursorY);
      (game as any).checkBlobMerges();
      expect((game as any).blobs).toHaveLength(1);

      activeDrop = (game as any).draggingBlob;
      expect(activeDrop.isDragging).toBe(true);
      expect(cursorX - (game as any).dragOffset.x).toBeCloseTo(activeDrop.x, 2);

      // Color should now be brown
      expect(activeDrop.colorName).toBe('brown');
    });
  });

  // =========================================================================
  // Mandate 4: BugCatcher GPU Tile Pattern vs CPU Churn
  // =========================================================================
  describe('Mandate 4: BugCatcher GPU Tile Pattern vs CPU Churn (BugCatcher)', () => {
    let game: BugCatcherGame;
    let canvas: HTMLCanvasElement;
    let mockCtx: any;

    beforeEach(() => {
      game = new BugCatcherGame();
      const mock = createMockCanvas(800, 600);
      canvas = mock.canvas;
      mockCtx = mock.ctx;
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('4.1: Noise tile is generated once at 128x128 resolution during onInit', () => {
      const tile = (game as any).noiseTile as HTMLCanvasElement;
      expect(tile).toBeDefined();
      expect(tile).not.toBeNull();
      expect(tile.width).toBe(128);
      expect(tile.height).toBe(128);

      const pattern = (game as any).noisePattern;
      expect(pattern).toBeDefined();
      expect(pattern).not.toBeNull();
    });

    it('4.2: Zero per-frame createImageData or putImageData calls during 120-frame animation loop', () => {
      const initialCreateCalls = mockCtx.createImageData.mock.calls.length;
      const initialPutCalls = mockCtx.putImageData.mock.calls.length;

      // Run 120 consecutive frames (2 full seconds at 60 FPS)
      for (let frame = 0; frame < 120; frame++) {
        game.update(16.666);
      }

      const frameCreateCalls = mockCtx.createImageData.mock.calls.length - initialCreateCalls;
      const framePutCalls = mockCtx.putImageData.mock.calls.length - initialPutCalls;

      // Assert ABSOLUTE ZERO per-frame ImageData calls
      expect(frameCreateCalls).toBe(0);
      expect(framePutCalls).toBe(0);
    });

    it('4.3: Background rendering uses GPU repeat pattern fillRect', () => {
      let patternAtFill: any = null;
      mockCtx.fillRect.mockImplementation((x: number, y: number, w: number, h: number) => {
        if (x === 0 && y === 0 && w === 800 && h === 600 && !patternAtFill) {
          patternAtFill = mockCtx.fillStyle;
        }
      });

      game.update(16.666);

      // Verify that the full-canvas background fillRect was called with noisePattern
      expect(patternAtFill).toBe((game as any).noisePattern);
    });

    it('4.4: Viewport resize reuses cached 128x128 tile without CPU noise recomputation', () => {
      const tileBefore = (game as any).noiseTile;
      const initialCreateCalls = mockCtx.createImageData.mock.calls.length;

      // Trigger resize to Full HD 1920x1080
      game.resize(1920, 1080);

      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);

      // Tile canvas element must be reused, NOT re-allocated
      expect((game as any).noiseTile).toBe(tileBefore);

      // No createImageData should be called during resize
      const resizeCreateCalls = mockCtx.createImageData.mock.calls.length - initialCreateCalls;
      expect(resizeCreateCalls).toBe(0);

      // Run 30 more frames
      for (let i = 0; i < 30; i++) {
        game.update(16.666);
      }

      // Still zero frame calls
      expect(mockCtx.createImageData.mock.calls.length - initialCreateCalls).toBe(0);
    });

    it('4.5: Fallback rendering path functions gracefully when CanvasPattern is unavailable', () => {
      // Temporarily null out noisePattern to test fallback branch
      (game as any).noisePattern = null;

      expect(() => {
        game.update(16.666);
      }).not.toThrow();

      // Either draws image repeatedly or fills with fallback color #85AB98
      expect(mockCtx.drawImage.mock.calls.length > 0 || mockCtx.fillRect.mock.calls.length > 0).toBe(true);
    });
  });
});
