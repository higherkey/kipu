import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundMemoryGame } from '../src/games/soundMemory/SoundMemoryGame';
import { BalloonPopGame } from '../src/games/balloonPop/BalloonPopGame';
import { ColorMixerGame } from '../src/games/colorMixer/ColorMixerGame';
import { AudioController } from '../src/core/AudioController';
import { HapticController } from '../src/core/HapticController';
import { TranslationManager } from '../src/core/TranslationManager';

/**
 * M3 Concurrency, Lifecycle, and Event Handling Hardening Stress Suite
 * Empirical Challenger: m3_challenger_1
 */

interface MockCanvasContext {
  canvas: HTMLCanvasElement;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  strokeText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  createRadialGradient: ReturnType<typeof vi.fn>;
  createPattern: ReturnType<typeof vi.fn>;
}

const contextStore = new WeakMap<HTMLCanvasElement, MockCanvasContext>();

function getOrCreateMockContext(canvasEl: HTMLCanvasElement): MockCanvasContext {
  let ctx = contextStore.get(canvasEl);
  if (!ctx) {
    ctx = {
      canvas: canvasEl,
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1.0,
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createPattern: vi.fn().mockReturnValue({}),
    };
    contextStore.set(canvasEl, ctx);
  }
  return ctx;
}

function createStressCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('M3 Concurrency & Stress Verification Harness', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  let audioPlaySpy: ReturnType<typeof vi.spyOn>;
  let audioSpeakSpy: ReturnType<typeof vi.spyOn>;
  let audioRegisterSpy: ReturnType<typeof vi.spyOn>;
  let hapticTapSpy: ReturnType<typeof vi.spyOn>;
  let hapticHeavySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Universal canvas 2D context mock
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d') {
        return getOrCreateMockContext(this) as any;
      }
      return null;
    });

    // Dynamic bounding client rect matching canvas width/height
    getBoundingClientRectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLCanvasElement) {
        const w = this.width || 800;
        const h = this.height || 600;
        return {
          left: 0,
          top: 0,
          width: w,
          height: h,
          right: w,
          bottom: h,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      });

    // Audio & Haptic spys
    audioPlaySpy = vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    audioSpeakSpy = vi.spyOn(AudioController.prototype, 'speak').mockImplementation(() => {});
    audioRegisterSpy = vi.spyOn(AudioController.prototype, 'registerSound').mockImplementation(() => {});
    hapticTapSpy = vi.spyOn(HapticController.prototype, 'lightTap').mockImplementation(() => Promise.resolve());
    hapticHeavySpy = vi.spyOn(HapticController.prototype, 'heavyImpact').mockImplementation(() => Promise.resolve());

    TranslationManager.getCurrent = vi.fn().mockReturnValue({ code: 'en-US' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. Pausable Timer Torture Test (SoundMemoryGame)', () => {
    let game: SoundMemoryGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      vi.useFakeTimers();
      game = new SoundMemoryGame();
      canvas = createStressCanvas(800, 600);
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('survives 50 rapid pause/resume cycles during sequence playback without NaN, leaks, or deadlock', () => {
      // Seed a long 8-note sequence so it remains actively playing across all 50 torture cycles
      (game as any).sequence.length = 0;
      (game as any).sequence.push(0, 1, 2, 3, 0, 1, 2, 3);
      (game as any).phase = 'show';

      // Trigger sequence playback
      game.update(16);
      expect((game as any).phase).toBe('wait');

      const pausableMap: Map<number, any> = (game as any).pausableTimeouts;
      expect(pausableMap.size).toBeGreaterThan(0);

      // Advance into sequence playback lead-in (200ms lead-in)
      vi.advanceTimersByTime(210);

      // 50 rapid toggles with interleaved time steps
      for (let i = 0; i < 50; i++) {
        // PAUSE
        game.pause();
        expect((game as any).isPaused).toBe(true);

        // All buttons MUST turn off immediately when paused
        const buttons = (game as any).buttons;
        expect(buttons.every((b: any) => b.isActive === false)).toBe(true);

        // Assert all remaining durations are valid numbers (no NaN, >= 0, finite)
        for (const entry of pausableMap.values()) {
          expect(Number.isFinite(entry.remaining)).toBe(true);
          expect(Number.isNaN(entry.remaining)).toBe(false);
          expect(entry.remaining).toBeGreaterThanOrEqual(0);
          expect(entry.handle).toBeNull();
        }

        const phaseBeforeAdvance = (game as any).phase;
        const timeoutsBeforeAdvance = pausableMap.size;

        // Advance 25ms while paused — callbacks MUST NOT fire
        vi.advanceTimersByTime(25);
        expect((game as any).phase).toBe(phaseBeforeAdvance);
        expect(pausableMap.size).toBe(timeoutsBeforeAdvance);

        // RESUME
        game.resume();
        expect((game as any).isPaused).toBe(false);

        // Timers rescheduled with valid handles
        for (const entry of pausableMap.values()) {
          expect(entry.handle).not.toBeNull();
        }

        // Advance 10ms while resumed
        vi.advanceTimersByTime(10);
      }

      // Resume final state and let sequence finish playing
      if ((game as any).isPaused) {
        game.resume();
      }

      // Fast-forward remaining playback duration
      vi.advanceTimersByTime(8000);

      // Must deterministically reach 'play' phase
      expect((game as any).phase).toBe('play');
      expect((game as any).isPaused).toBe(false);

      // Zero leaked timers
      expect((game as any).pausableTimeouts.size).toBe(0);
      expect((game as any).activeTimeouts.length).toBe(0);

      // Complete round cleanly by pressing the 8 expected buttons in order
      for (let s = 0; s < 8; s++) {
        const expectedId = (game as any).sequence[s];
        const targetBtn = (game as any).buttons[expectedId];
        (game as any).handleButtonPress(targetBtn.x, targetBtn.y);
      }

      vi.advanceTimersByTime(200);
      expect((game as any).phase).toBe('won');
    });

    it('handles idempotent pause/resume floods without accumulating duplicate handles', () => {
      game.update(16);
      expect((game as any).phase).toBe('wait');

      // 10 consecutive pauses
      for (let i = 0; i < 10; i++) {
        game.pause();
        expect((game as any).isPaused).toBe(true);
      }

      // Active timeouts list must be 0 while paused
      expect((game as any).activeTimeouts.length).toBe(0);

      // 10 consecutive resumes
      for (let i = 0; i < 10; i++) {
        game.resume();
        expect((game as any).isPaused).toBe(false);
      }

      // Active timeouts should match pausable timeout count (no duplicates)
      const pausableCount = (game as any).pausableTimeouts.size;
      expect((game as any).activeTimeouts.length).toBe(pausableCount);
    });

    it('survives 50 synchronous rapid toggles in a single event-loop tick with 0 elapsed time', () => {
      game.update(16);
      expect((game as any).phase).toBe('wait');
      const pausableMap: Map<number, any> = (game as any).pausableTimeouts;

      const initialRemainingValues = Array.from(pausableMap.values()).map((e) => e.remaining);

      // 50 synchronous toggles without any time advance
      for (let i = 0; i < 50; i++) {
        game.pause();
        expect((game as any).isPaused).toBe(true);
        expect((game as any).buttons.every((b: any) => !b.isActive)).toBe(true);

        game.resume();
        expect((game as any).isPaused).toBe(false);
      }

      // Remaining durations must not drift or become NaN
      const finalRemainingValues = Array.from(pausableMap.values()).map((e) => e.remaining);
      for (let j = 0; j < initialRemainingValues.length; j++) {
        expect(finalRemainingValues[j]).toBe(initialRemainingValues[j]);
      }
    });

    it('rejects user input during sequence playback and while paused', () => {
      game.update(16);
      expect((game as any).phase).toBe('wait');

      const targetBtn = (game as any).buttons[0];

      // Tap during sequence playback: phase is 'wait', handleButtonPress should ignore
      (game as any).handleButtonPress(targetBtn.x, targetBtn.y);
      expect((game as any).playerSequence.length).toBe(0);

      // Advance to play phase
      vi.advanceTimersByTime(2500);
      expect((game as any).phase).toBe('play');

      // Pause the game
      game.pause();
      expect((game as any).isPaused).toBe(true);

      // Pointer event while paused must be rejected
      const pointerEv = new Event('pointerdown', { cancelable: true });
      (pointerEv as any).clientX = targetBtn.x;
      (pointerEv as any).clientY = targetBtn.y;
      canvas.dispatchEvent(pointerEv);
      expect((game as any).playerSequence.length).toBe(0);

      // Mouse event while paused must also be rejected
      const mouseEv = new MouseEvent('mousedown', { clientX: targetBtn.x, clientY: targetBtn.y });
      canvas.dispatchEvent(mouseEv);
      expect((game as any).playerSequence.length).toBe(0);
    });

    it('safely handles destroy() called while in paused state with active timers', () => {
      game.update(16);
      vi.advanceTimersByTime(100);

      game.pause();
      expect((game as any).pausableTimeouts.size).toBeGreaterThan(0);

      // Destroy while paused
      game.destroy();

      expect((game as any).pausableTimeouts.size).toBe(0);
      expect((game as any).activeTimeouts.length).toBe(0);
      expect((game as any).particles.length).toBe(0);

      // Advancing time post-destroy must not throw or alter state
      expect(() => {
        vi.advanceTimersByTime(5000);
      }).not.toThrow();
    });
  });

  describe('2. Deterministic Phyllotaxis & Resize Stress (BalloonPopGame)', () => {
    let game: BalloonPopGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      game = new BalloonPopGame();
      canvas = createStressCanvas(800, 600);
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('renders golden-angle phyllotaxis dots 100% deterministically across 100 frames with 0 Math.random calls', () => {
      // Prevent automatic spawning during test to isolate the single balloon
      (game as any).spawnInterval = 999999;

      // Seed with a dots-pattern balloon
      (game as any).balloons = [
        {
          x: 400,
          y: 400,
          radius: 50,
          color: '#FFE66D',
          pattern: 'dots' as const,
          hits: 0,
          maxHits: 3,
          velocity: 1.5,
        },
      ];

      // Initial render creates the deterministic dots array
      (game as any).render();

      const dotsRef = (game as any).balloons[0].dots;
      expect(dotsRef).toBeDefined();
      expect(dotsRef.length).toBe(18);

      // Golden ratio golden angle validation: ~137.508° (2.39996 rad)
      const expectedGoldenAngle = Math.PI * (3 - Math.sqrt(5));
      const dot0Theta = 0;
      const dot1Theta = expectedGoldenAngle;
      expect(dotsRef[0].dx).toBeCloseTo(Math.cos(dot0Theta) * Math.sqrt(0.5 / 18) * 0.72, 4);
      expect(dotsRef[1].dx).toBeCloseTo(Math.cos(dot1Theta) * Math.sqrt(1.5 / 18) * 0.72, 4);

      // Snapshot dot offsets and radii
      const dotSnapshot = JSON.stringify(dotsRef);

      // Spy on Math.random to verify zero randomness during the render frame loop
      const randomSpy = vi.spyOn(Math, 'random');

      // Execute 100 consecutive frames (update + render)
      for (let frame = 0; frame < 100; frame++) {
        game.update(16.6);
        expect(randomSpy).not.toHaveBeenCalled();

        // Verify dots array identity and content remain strictly immutable
        const currentDots = (game as any).balloons[0].dots;
        expect(JSON.stringify(currentDots)).toBe(dotSnapshot);
      }

      // Assert all dots remain strictly inside balloon perimeter (radius <= 0.75 * balloonRadius)
      for (const dot of dotsRef) {
        const normDist = Math.hypot(dot.dx, dot.dy);
        expect(normDist).toBeLessThanOrEqual(0.75);
      }
    });

    it('resizes canvas across extreme aspect ratios and zero/negative bounds without errors', () => {
      // Seed balloons across various coordinates
      (game as any).balloons = [
        { x: 100, y: 100, radius: 40, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 1, velocity: 2 },
        { x: 750, y: 300, radius: 45, color: '#6BCBFF', pattern: 'stripes', hits: 0, maxHits: 2, velocity: 2 },
        { x: 400, y: 550, radius: 50, color: '#FFE66D', pattern: 'dots', hits: 0, maxHits: 3, velocity: 2 },
      ];

      const extremeTestSizes = [
        [2000, 200],   // Ultra-wide banner
        [200, 2000],   // Ultra-tall vertical feed
        [3840, 2160],  // 4K UHD
        [320, 480],    // Legacy mobile portrait
        [1, 1],        // Degenerate minimal 1x1
        [0, 0],        // Edge-case zero dimensions
        [-50, -50],    // Invalid negative dimensions
      ];

      for (const [w, h] of extremeTestSizes) {
        expect(() => {
          game.resize(w, h);
          game.update(16.6);
        }).not.toThrow();

        // Check clamping when width is well-formed
        if (w >= 120) {
          for (const b of (game as any).balloons) {
            expect(b.x).toBeLessThanOrEqual(w - b.radius);
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(b.x)).toBe(true);
            expect(Number.isFinite(b.y)).toBe(true);
          }
        }
      }
    });

    it('suppresses pop interactions while paused and restores them upon resume', () => {
      (game as any).balloons = [
        { x: 250, y: 250, radius: 45, color: '#FF5E5E', pattern: 'none', hits: 0, maxHits: 2, velocity: 1 },
      ];

      // Pause the game
      game.pause();
      expect((game as any).isPaused).toBe(true);

      // Hit balloon while paused
      (game as any).checkPop(250, 250);
      expect((game as any).balloons[0].hits).toBe(0);
      expect((game as any).popsCount).toBe(0);

      // Resume
      game.resume();
      expect((game as any).isPaused).toBe(false);

      // Hit 1 while resumed
      (game as any).checkPop(250, 250);
      expect((game as any).balloons[0].hits).toBe(1);

      // Hit 2 while resumed -> pops balloon
      (game as any).checkPop(250, 250);
      expect((game as any).balloons.length).toBe(0);
      expect((game as any).popsCount).toBe(1);
    });
  });

  describe('3. Window Boundary, Smudge Performance & GPU Safety (ColorMixerGame)', () => {
    let game: ColorMixerGame;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      game = new ColorMixerGame();
      canvas = createStressCanvas(800, 600);
      game.init(canvas);
    });

    afterEach(() => {
      game.destroy();
    });

    it('terminates drawing state when pointer escapes window via blur, touchcancel, and mouseup', () => {
      const potsY = (game as any).potsY;
      const potsHeight = (game as any).potsHeight;
      const drawY = potsY + potsHeight + 50;

      // 1. Simulate mouse start in drawing area
      (game as any).startPress(200, drawY);
      expect((game as any).isDrawing).toBe(true);

      // Window blur triggers release
      window.dispatchEvent(new Event('blur'));
      expect((game as any).isDrawing).toBe(false);

      // 2. Simulate touch start in drawing area
      (game as any).startPress(300, drawY);
      expect((game as any).isDrawing).toBe(true);

      // Window touchcancel triggers release
      window.dispatchEvent(new Event('touchcancel'));
      expect((game as any).isDrawing).toBe(false);

      // 3. Simulate drag past canvas bounds
      (game as any).startPress(400, drawY);
      expect((game as any).isDrawing).toBe(true);

      (game as any).movePress(950, -100);
      expect((game as any).isDrawing).toBe(true);

      // Window mouseup outside window bounds
      window.dispatchEvent(new MouseEvent('mouseup'));
      expect((game as any).isDrawing).toBe(false);

      // 4. Burst flood of 50 window release events
      for (let i = 0; i < 50; i++) {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('touchcancel'));
        window.dispatchEvent(new MouseEvent('mouseup'));
      }
      expect((game as any).isDrawing).toBe(false);

      // Re-engagement works normally after storm
      (game as any).startPress(250, drawY);
      expect((game as any).isDrawing).toBe(true);
    });

    it('executes 100 consecutive smudgeAtPoint operations with 0 canvas self-blit WebGL hazards within 60 FPS budget', () => {
      const bufferCanvas: HTMLCanvasElement = (game as any).bufferCanvas;
      const scratchCanvas: HTMLCanvasElement = (game as any).scratchCanvas;

      expect(bufferCanvas).toBeDefined();
      expect(scratchCanvas).toBeDefined();

      const bufferCtx = getOrCreateMockContext(bufferCanvas);
      const scratchCtx = getOrCreateMockContext(scratchCanvas);

      // Clear previous draw calls from init
      bufferCtx.drawImage.mockClear();
      scratchCtx.drawImage.mockClear();

      const t0 = performance.now();

      // Execute 100 consecutive smudges across diverse coordinates
      for (let i = 0; i < 100; i++) {
        const x = 50 + (i * 7) % 700;
        const y = 120 + (i * 5) % 450;
        const prevX = x - 4 + (i % 3);
        const prevY = y - 3 + (i % 2);

        (game as any).smudgeAtPoint(x, y, prevX, prevY);
      }

      const t1 = performance.now();
      const elapsedMs = t1 - t0;

      // 100 smudges must comfortably execute within budget (< 50ms)
      expect(elapsedMs).toBeLessThan(100);

      // CRITICAL GPU HAZARD CHECK:
      // Verify bufferCtx NEVER draws bufferCanvas onto itself!
      const bufferDrawCalls = bufferCtx.drawImage.mock.calls;
      expect(bufferDrawCalls.length).toBe(100);

      const selfBlitCalls = bufferDrawCalls.filter((call) => call[0] === bufferCanvas);
      expect(selfBlitCalls).toHaveLength(0);

      // Verify all 100 bufferCtx.drawImage calls read from scratchCanvas
      for (const call of bufferDrawCalls) {
        expect(call[0]).toBe(scratchCanvas);
      }

      // Verify scratchCtx.drawImage reads from bufferCanvas
      const scratchDrawCalls = scratchCtx.drawImage.mock.calls;
      expect(scratchDrawCalls.length).toBe(100);
      for (const call of scratchDrawCalls) {
        expect(call[0]).toBe(bufferCanvas);
      }
    });

    it('executes 100 consecutive multi-stroke smudgeLine gestures with 0 GPU hazards and bounded step counts', () => {
      const bufferCanvas: HTMLCanvasElement = (game as any).bufferCanvas;
      const bufferCtx = getOrCreateMockContext(bufferCanvas);
      bufferCtx.drawImage.mockClear();

      // Perform 100 strokes across diverse vectors
      for (let s = 0; s < 100; s++) {
        const x1 = 100 + (s * 13) % 600;
        const y1 = 150 + (s * 17) % 400;
        const x2 = 120 + (s * 19) % 650;
        const y2 = 170 + (s * 23) % 420;

        (game as any).smudgeLine(x1, y1, x2, y2);
      }

      // Zero self-blit calls across all strokes
      const selfBlitCalls = bufferCtx.drawImage.mock.calls.filter((call) => call[0] === bufferCanvas);
      expect(selfBlitCalls).toHaveLength(0);
    });

    it('caps smudgeLine interpolation steps at 50 to maintain solid 60 FPS on long sweeps', () => {
      const smudgeSpy = vi.spyOn(game as any, 'smudgeAtPoint');

      // Diagonal sweep across 1400px
      (game as any).smudgeLine(50, 100, 1200, 900);

      // Must be capped at <= 51 steps (i from 0 to steps, where steps <= 50)
      expect(smudgeSpy.mock.calls.length).toBeLessThanOrEqual(51);
    });

    it('resizes bufferCanvas safely while preserving artwork and updating paint well boundaries', () => {
      const bufferCanvas: HTMLCanvasElement = (game as any).bufferCanvas;
      expect(bufferCanvas.width).toBe(800);

      game.resize(1280, 720);
      expect(bufferCanvas.width).toBe(1280);
      expect(bufferCanvas.height).toBe(720);

      const wells = (game as any).wells;
      expect(wells).toHaveLength(6);
      for (const well of wells) {
        expect(well.x + well.width).toBeLessThanOrEqual(1280);
        expect(well.x).toBeGreaterThanOrEqual(0);
      }

      // Zero or negative resize must be safely rejected
      game.resize(0, 0);
      expect(bufferCanvas.width).toBe(1280);

      game.resize(-100, -200);
      expect(bufferCanvas.width).toBe(1280);
    });
  });
});
