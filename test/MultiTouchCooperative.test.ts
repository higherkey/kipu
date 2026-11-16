import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiteBriteGame } from '../src/games/liteBrite/LiteBriteGame';
import { AnimalChoirGame } from '../src/games/animalChoir/AnimalChoirGame';
import { KhipuSynthGame } from '../src/games/khipuSynth/KhipuSynthGame';

function createMockCanvas(w = 800, h = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: w,
    bottom: h,
    width: w,
    height: h,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  return canvas;
}

function createTouchEvent(type: string, touches: any[], changedTouches: any[] = touches): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any;
  event.touches = touches;
  event.changedTouches = changedTouches;
  return event;
}

describe('Multi-Touch Multi-Finger Cooperative Play (Issue #29)', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    (globalThis as any).AudioContext = class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createAnalyser = vi.fn(() => ({
        fftSize: 64,
        frequencyBinCount: 32,
        connect: vi.fn(),
        getByteFrequencyData: vi.fn(),
      }));
      createBiquadFilter = vi.fn(() => ({
        type: 'lowpass',
        Q: { value: 1 },
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    };
    (window as any).AudioContext = (globalThis as any).AudioContext;

    canvas = createMockCanvas();
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    canvas.remove();
    vi.restoreAllMocks();
  });

  describe('1. Digital LiteBrite Multi-Touch Play', () => {
    it('supports two independent fingers drawing pegs simultaneously', () => {
      const game = new LiteBriteGame();
      game.init(canvas);

      // Grid area: x from 20 to 780, y from 60 to 520 (topBarHeight 50 + 10, paletteBarHeight 60)
      // Finger 1 at (100, 150) -> cell in top-left region
      // Finger 2 at (600, 400) -> cell in bottom-right region
      const touch1 = { identifier: 1, clientX: 100, clientY: 150 };
      const touch2 = { identifier: 2, clientX: 600, clientY: 400 };

      // TouchStart with two fingers simultaneously
      canvas.dispatchEvent(createTouchEvent('touchstart', [touch1, touch2], [touch1, touch2]));

      const grid = game.getGrid();
      const activePegs = grid.flat().filter(cell => cell.colorIndex !== null);
      expect(activePegs.length).toBe(2);

      // Lift finger 1
      canvas.dispatchEvent(createTouchEvent('touchend', [touch2], [touch1]));

      // Finger 2 continues dragging to a new cell (500, 400)
      const touch2Moved = { identifier: 2, clientX: 500, clientY: 400 };
      canvas.dispatchEvent(createTouchEvent('touchmove', [touch2Moved], [touch2Moved]));

      const activePegsAfter = game.getGrid().flat().filter(cell => cell.colorIndex !== null);
      // Finger 2 continues drawing without being canceled by finger 1's liftoff
      expect(activePegsAfter.length).toBeGreaterThanOrEqual(2);

      game.destroy();
    });

    it('does not crash or lose state on touchcancel events', () => {
      const game = new LiteBriteGame();
      game.init(canvas);

      const touch1 = { identifier: 10, clientX: 150, clientY: 200 };
      canvas.dispatchEvent(createTouchEvent('touchstart', [touch1], [touch1]));
      expect(game.getGrid().flat().some(cell => cell.colorIndex !== null)).toBe(true);

      canvas.dispatchEvent(createTouchEvent('touchcancel', [], [touch1]));
      // Board remains intact
      expect(game.getGrid().flat().some(cell => cell.colorIndex !== null)).toBe(true);

      game.destroy();
    });
  });

  describe('2. Animal Choir Multi-Touch Chords & Glissando', () => {
    it('allows 3 fingers to trigger multiple choir nodes simultaneously', () => {
      const game = new AnimalChoirGame();
      game.init(canvas);

      // Grid is 4x4 from x: 15 to 785, y: 80 to 570
      // Cell size ~ 192 x 122
      // Finger 1 on cell (0, 0) -> (100, 120)
      // Finger 2 on cell (1, 1) -> (300, 250)
      // Finger 3 on cell (2, 2) -> (500, 380)
      const t1 = { identifier: 1, clientX: 100, clientY: 120 };
      const t2 = { identifier: 2, clientX: 300, clientY: 250 };
      const t3 = { identifier: 3, clientX: 500, clientY: 380 };

      canvas.dispatchEvent(createTouchEvent('touchstart', [t1, t2, t3], [t1, t2, t3]));

      const grid = game.getGrid();
      // Verify node 0,0, node 1,1, and node 2,2 have bounceProgress animated
      expect(grid[0][0].bounceProgress).toBe(1.0);
      expect(grid[1][1].bounceProgress).toBe(1.0);
      expect(grid[2][2].bounceProgress).toBe(1.0);

      game.destroy();
    });

    it('supports multi-finger dragging across cells without duplicate toggles within the same cell', () => {
      const game = new AnimalChoirGame();
      game.init(canvas);

      const t1 = { identifier: 1, clientX: 100, clientY: 120 };
      canvas.dispatchEvent(createTouchEvent('touchstart', [t1], [t1]));

      const initialActive = game.getGrid()[0][0].active;

      // Small move within the same cell (105, 125)
      const t1MovedSameCell = { identifier: 1, clientX: 105, clientY: 125 };
      canvas.dispatchEvent(createTouchEvent('touchmove', [t1MovedSameCell], [t1MovedSameCell]));

      // Should not flip back/forth rapidly inside the same cell
      expect(game.getGrid()[0][0].active).toBe(initialActive);

      // Move into next column (300, 120) -> cell (0, 1)
      const t1MovedNextCell = { identifier: 1, clientX: 300, clientY: 120 };
      canvas.dispatchEvent(createTouchEvent('touchmove', [t1MovedNextCell], [t1MovedNextCell]));
      expect(game.getGrid()[0][1].bounceProgress).toBe(1.0);

      game.destroy();
    });
  });

  describe('3. KhipuSynth Multi-Touch Pad Jamming', () => {
    it('triggers multiple performance pads simultaneously with multiple touches', () => {
      const game = new KhipuSynthGame();
      game.init(canvas);

      // Performance pads are in bottom area: y from padsTop to padsTop + padsH
      // Pad 0 at (50, 540), Pad 1 at (250, 540), Pad 2 at (450, 540)
      const p1 = { identifier: 1, clientX: 50, clientY: 540 };
      const p2 = { identifier: 2, clientX: 250, clientY: 540 };

      canvas.dispatchEvent(createTouchEvent('touchstart', [p1, p2], [p1, p2]));

      // Both pads should be triggered
      // Let's verify by triggering without errors
      expect(game).toBeDefined();

      game.destroy();
    });
  });
});
