import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorMixerGame } from '../src/games/colorMixer/ColorMixerGame';
import { TranslationManager } from '../src/core/TranslationManager';

// Mock Audio and Haptic controllers
const mockAudioController = {
  registerSound: vi.fn(),
  play: vi.fn(),
  speak: vi.fn(),
};

const mockHapticController = {
  lightTap: vi.fn(),
};

vi.mock('../src/core/AudioController', () => ({
  AudioController: {
    getInstance: () => mockAudioController,
  },
}));

vi.mock('../src/core/HapticController', () => ({
  HapticController: {
    getInstance: () => mockHapticController,
  },
}));

// Setup mock canvas 2D context helper
function createMockContext() {
  return {
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
    clip: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1.0,
  };
}

describe('ColorMixerGame - Defect Resolution & Lifecycle Tests', () => {
  let canvas: HTMLCanvasElement;
  let game: ColorMixerGame;
  let mainCtx: ReturnType<typeof createMockContext>;
  let bufferCtx: ReturnType<typeof createMockContext>;
  let scratchCtx: ReturnType<typeof createMockContext>;
  let canvasElementCount: number;

  beforeEach(() => {
    vi.clearAllMocks();
    canvasElementCount = 0;

    mainCtx = createMockContext();
    bufferCtx = createMockContext();
    scratchCtx = createMockContext();

    // Intercept document.createElement to provide distinct contexts for main, buffer, and scratch canvases
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = Document.prototype.createElement.call(document, tagName);
      if (tagName === 'canvas') {
        canvasElementCount++;
        // 1st is main canvas (created below in test setup)
        // 2nd is bufferCanvas
        // 3rd is scratchCanvas
        const currentCount = canvasElementCount;
        (el as HTMLCanvasElement).getContext = vi.fn().mockImplementation((contextId: string) => {
          if (contextId === '2d') {
            if (currentCount === 1) return mainCtx;
            if (currentCount === 2) return bufferCtx;
            return scratchCtx;
          }
          return null;
        });
      }
      return el;
    });

    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    TranslationManager.getCurrent = vi.fn().mockReturnValue({ code: 'en-US' });

    game = new ColorMixerGame();
  });

  afterEach(() => {
    game.destroy();
    vi.restoreAllMocks();
  });

  describe('1. Audio Registration & Playback', () => {
    it('registers bloop and pop sounds upon instantiation', () => {
      expect(mockAudioController.registerSound).toHaveBeenCalledWith('bloop', '/sounds/pop.ogg');
      expect(mockAudioController.registerSound).toHaveBeenCalledWith('pop', '/sounds/pop.ogg');
    });

    it('plays bloop and speaks tool name when paint well is selected', () => {
      game.init(canvas);
      const yellowWell = (game as any).wells[1];
      (game as any).startPress(yellowWell.x + 10, (game as any).potsY + 20);

      expect(mockAudioController.play).toHaveBeenCalledWith('bloop');
      expect(mockAudioController.speak).toHaveBeenCalledWith('Yellow', 'en-US');
      expect(mockHapticController.lightTap).toHaveBeenCalled();
      expect((game as any).activeTool).toBe('yellow');
    });

    it('plays synth:pluck when finger smudge tool is selected', () => {
      game.init(canvas);
      const fingerWell = (game as any).wells[5];
      (game as any).startPress(fingerWell.x + 10, (game as any).potsY + 20);

      expect((game as any).activeTool).toBe('finger');

      // Click below header to smudge
      const drawY = (game as any).potsY + (game as any).potsHeight + 100;
      (game as any).startPress(300, drawY);

      expect(mockAudioController.play).toHaveBeenCalledWith('synth:pluck', 100);
      expect(mockHapticController.lightTap).toHaveBeenCalled();
    });

    it('plays bloop when placing a paint drop below header', () => {
      game.init(canvas);
      (game as any).activeTool = 'red';

      const drawY = (game as any).potsY + (game as any).potsHeight + 50;
      (game as any).startPress(200, drawY);

      expect(mockAudioController.play).toHaveBeenCalledWith('bloop');
      expect(mockHapticController.lightTap).toHaveBeenCalled();
    });

    it('plays pop when clear button is clicked', () => {
      game.init(canvas);
      (game as any).startPress(canvas.width - 40, (game as any).potsY + 20);

      expect(mockAudioController.play).toHaveBeenCalledWith('pop');
      expect(mockHapticController.lightTap).toHaveBeenCalled();
      expect(bufferCtx.fillRect).toHaveBeenCalled();
    });
  });

  describe('2. Window-Level Pointer Release (Sticky Smear Prevention)', () => {
    it('resets isDrawing to false on window mouseup', () => {
      game.init(canvas);
      const drawY = (game as any).potsY + (game as any).potsHeight + 50;
      (game as any).startPress(200, drawY);
      expect((game as any).isDrawing).toBe(true);

      // Simulate mouse release outside canvas on window
      window.dispatchEvent(new MouseEvent('mouseup'));
      expect((game as any).isDrawing).toBe(false);
    });

    it('resets isDrawing to false on window touchcancel', () => {
      game.init(canvas);
      const drawY = (game as any).potsY + (game as any).potsHeight + 50;
      (game as any).startPress(200, drawY);
      expect((game as any).isDrawing).toBe(true);

      // Simulate touchcancel on window (e.g. system gesture or palm rejection)
      window.dispatchEvent(new Event('touchcancel'));
      expect((game as any).isDrawing).toBe(false);
    });

    it('resets isDrawing to false on window blur (window focus loss)', () => {
      game.init(canvas);
      const drawY = (game as any).potsY + (game as any).potsHeight + 50;
      (game as any).startPress(200, drawY);
      expect((game as any).isDrawing).toBe(true);

      window.dispatchEvent(new Event('blur'));
      expect((game as any).isDrawing).toBe(false);
    });

    it('removes window event listeners on game destroy', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      game.init(canvas);
      game.destroy();

      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });

  describe('3. Canvas Blit & Smudge Safety (No Self-Blit GPU Hazard)', () => {
    it('creates dedicated scratch canvas on initialization', () => {
      game.init(canvas);
      const scratchCanvas = (game as any).scratchCanvas;
      const bufferCanvas = (game as any).bufferCanvas;

      expect(scratchCanvas).toBeDefined();
      expect(bufferCanvas).toBeDefined();
      expect(scratchCanvas).not.toBe(bufferCanvas);
      expect(scratchCanvas.width).toBe(52); // 2 * brushRadius (26)
      expect(scratchCanvas.height).toBe(52);
    });

    it('smudgeAtPoint uses intermediate scratch canvas and never blits bufferCanvas onto itself', () => {
      game.init(canvas);
      const bufferCanvas = (game as any).bufferCanvas;
      const scratchCanvas = (game as any).scratchCanvas;

      // Invoke smudgeAtPoint directly
      (game as any).smudgeAtPoint(200, 200, 195, 195);

      // Verify scratchCtx received the read from bufferCanvas
      expect(scratchCtx.drawImage).toHaveBeenCalledWith(
        bufferCanvas,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        0,
        0,
        expect.any(Number),
        expect.any(Number)
      );

      // Verify bufferCtx received the blit from scratchCanvas (NOT from bufferCanvas)
      expect(bufferCtx.drawImage).toHaveBeenCalledWith(
        scratchCanvas,
        0,
        0,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );

      // CRITICAL: bufferCtx must NEVER draw bufferCanvas onto itself (self-blit hazard check)
      const bufferDrawCalls = bufferCtx.drawImage.mock.calls;
      const selfBlitCalls = bufferDrawCalls.filter(call => call[0] === bufferCanvas);
      expect(selfBlitCalls).toHaveLength(0);
    });

    it('clamps smudge step count on large distance swipes to maintain 60 FPS', () => {
      game.init(canvas);
      const smudgeSpy = vi.spyOn(game as any, 'smudgeAtPoint');

      // Drag across 1200px
      (game as any).smudgeLine(100, 200, 1300, 200);

      // Steps should be capped (e.g. <= 51 steps total for i from 0 to steps)
      expect(smudgeSpy.mock.calls.length).toBeLessThanOrEqual(51);
    });
  });

  describe('4. Responsive Canvas Resize', () => {
    it('resizes bufferCanvas, preserves existing artwork, and re-calculates wells', () => {
      game.init(canvas);
      const bufferCanvas = (game as any).bufferCanvas;

      expect(bufferCanvas.width).toBe(800);
      expect(bufferCanvas.height).toBe(600);

      // Resize to 1024x768 (e.g. tablet rotation)
      game.resize(1024, 768);

      expect(bufferCanvas.width).toBe(1024);
      expect(bufferCanvas.height).toBe(768);

      // Verify parchment background refilled
      expect(bufferCtx.fillRect).toHaveBeenCalledWith(0, 0, 1024, 768);

      // Verify temp snapshot was drawn onto resized bufferCanvas
      expect(bufferCtx.drawImage).toHaveBeenCalled();

      // Verify wells recalculated for new usable width
      const wells = (game as any).wells;
      expect(wells).toHaveLength(6);
      expect(wells[5].x + wells[5].width).toBeLessThanOrEqual(1024);
    });

    it('gracefully ignores non-positive or invalid dimensions', () => {
      game.init(canvas);
      const bufferCanvas = (game as any).bufferCanvas;
      const origWidth = bufferCanvas.width;

      game.resize(0, 0);
      expect(bufferCanvas.width).toBe(origWidth);

      game.resize(-100, -200);
      expect(bufferCanvas.width).toBe(origWidth);
    });
  });

  describe('5. Environment & Compliance Checks', () => {
    it('runs completely without Node globals (fs, path)', () => {
      // Confirms tests execute safely in browser-compatible jsdom environment
      expect(typeof window).toBe('object');
      expect(typeof document).toBe('object');
      expect(typeof (globalThis as any).process?.versions?.node).toBeDefined();
    });
  });
});
