import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoButtonGame } from '../src/games/noButton/NoButtonGame';
import { TranslationManager } from '../src/core/TranslationManager';
import { AudioController } from '../src/core/AudioController';
import { SoundWaveStudioGame } from '../src/games/busyBoard/SoundWaveStudioGame';
import { TypographyBoardGame } from '../src/games/busyBoard/TypographyBoardGame';
import { EquationTowerGame } from '../src/games/equationTower/EquationTowerGame';
import { TrashSorcererGame } from '../src/games/trashSorcerer/TrashSorcererGame';
import { CloudShapeGame } from '../src/games/cloudShape/CloudShapeGame';
import { AnimalChoirGame } from '../src/games/animalChoir/AnimalChoirGame';
import { VibeCoderGame } from '../src/games/vibeCoder/VibeCoderGame';

function createMockCanvas(width = 800, height = 600): { canvas: HTMLCanvasElement; ctx: any } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  // Track bounding client rect for pointer simulation
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: canvas.width,
    bottom: canvas.height,
    width: canvas.width,
    height: canvas.height,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));

  const ctxBase: Record<string, any> = {
    canvas,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    measureText: vi.fn(() => ({ width: 50 })),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };

  const ctx = new Proxy(ctxBase, {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      if (typeof prop === 'string') {
        (target as any)[prop] = vi.fn();
        return (target as any)[prop];
      }
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === 'string') {
        (target as any)[prop] = value;
        return true;
      }
      return false;
    },
  });

  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  return { canvas, ctx };
}

describe('M4 Adversarial Stress: Eeno Voice Board & Phase 3 Games Hardening', () => {
  beforeEach(() => {
    (globalThis as any).AudioContext = class MockAudioContext {
      destination = {};
      currentTime = 0;
      state = 'running';
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createBuffer() { return {}; }
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    } as any;
  });

  describe('1. Eeno Voice Board Stress & Resilience (Feature 14 / Issue #34)', () => {
    let game: NoButtonGame;
    let canvas: HTMLCanvasElement;
    let playAudioSpy: ReturnType<typeof vi.spyOn>;
    let speakAudioSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.clearAllMocks();
      document.body.innerHTML = '<div id="app"></div>';
      const mockCanvasObj = createMockCanvas();
      canvas = mockCanvasObj.canvas;

      (globalThis as any).SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
        text: string;
        lang = '';
        pitch = 1;
        rate = 1;
        voice: any = null;
        constructor(text: string) {
          this.text = text;
        }
      };

      (AudioController as any).instance = undefined;
      playAudioSpy = vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
      speakAudioSpy = vi.spyOn(AudioController.prototype, 'speak');
      vi.spyOn(AudioController.prototype, 'isLanguageSupported').mockReturnValue(true);

      TranslationManager.setLanguage('en-US');
    });

    afterEach(() => {
      if (game) {
        try {
          game.destroy();
        } catch {
          // ignore teardown error in stress tests
        }
      }
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('gracefully handles SpeechSynthesis completely undefined across all 4 categories', () => {
      delete (window as any).speechSynthesis;

      game = new NoButtonGame();
      game.init(canvas);

      // Category 1: Basic
      game.setCategory('basic');
      const yesBtn = document.getElementById('giant-yes-button') as HTMLButtonElement;
      const noBtn = document.getElementById('giant-no-button') as HTMLButtonElement;
      expect(() => yesBtn.click()).not.toThrow();
      expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);

      playAudioSpy.mockClear();
      expect(() => noBtn.click()).not.toThrow();
      expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);

      // Category 2: Greetings
      game.setCategory('greetings');
      const greetingCards = document.querySelectorAll('.eeno-word-card');
      expect(greetingCards.length).toBeGreaterThanOrEqual(4);
      greetingCards.forEach(card => {
        playAudioSpy.mockClear();
        expect(() => (card as HTMLButtonElement).click()).not.toThrow();
        expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);
      });

      // Category 3: Colors
      game.setCategory('colors');
      const colorCards = document.querySelectorAll('.eeno-color-card');
      expect(colorCards.length).toBeGreaterThanOrEqual(4);
      colorCards.forEach(card => {
        playAudioSpy.mockClear();
        expect(() => (card as HTMLButtonElement).click()).not.toThrow();
        expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);
      });

      // Category 4: Numbers
      game.setCategory('numbers');
      const numberCards = document.querySelectorAll('.eeno-number-btn');
      expect(numberCards.length).toBe(10);
      numberCards.forEach(card => {
        playAudioSpy.mockClear();
        expect(() => (card as HTMLButtonElement).click()).not.toThrow();
        expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);
      });
    });

    it('adversarial check: handles environment where window.speechSynthesis is undefined property on window', () => {
      // In webviews or restricted contexts, 'speechSynthesis' in window is true, but window.speechSynthesis is undefined
      (window as any).speechSynthesis = undefined;
      expect('speechSynthesis' in window).toBe(true);

      let initThrew = false;
      let initError: any = null;
      try {
        game = new NoButtonGame();
        game.init(canvas);
      } catch (err) {
        initThrew = true;
        initError = err;
      }

      if (initThrew) {
        console.warn(`[EMPIRICAL DEFECT] NoButtonGame crashed on init when window.speechSynthesis is undefined: ${initError?.message}`);
      }
      expect(initThrew).toBe(false);
    });

    it('adversarial check: handles SpeechSynthesis.speak throwing an error during playback', () => {
      // Mock window.speechSynthesis where speak() throws an exception (e.g. audio context blocked / hardware fail)
      const mockSpeak = vi.fn().mockImplementation(() => {
        throw new Error('TTS Hardware SpeechSynthesis Failure');
      });

      (window as any).speechSynthesis = {
        speak: mockSpeak,
        cancel: vi.fn(),
        getVoices: vi.fn(() => [{ name: 'Default Voice', lang: 'en-US' }]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      game = new NoButtonGame();
      game.init(canvas);

      // Testing basic button tap when speak throws
      // If speak throws an exception, verify whether it is caught and triggers fallback chime
      let basicThrew = false;
      let errorThrown: any = null;
      try {
        const yesBtn = document.getElementById('giant-yes-button') as HTMLButtonElement;
        yesBtn.click();
      } catch (err) {
        basicThrew = true;
        errorThrown = err;
      }

      // Assert whether speech failure throws an unhandled exception or falls back to chime
      if (basicThrew) {
        console.warn(`[EMPIRICAL DEFECT] SpeechSynthesis.speak failure threw unhandled exception: ${errorThrown?.message}`);
      }
      expect(basicThrew).toBe(false);
      expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);
    });

    it('stress tests rapid category switching (50 switches in 1 second) without DOM duplication or state corruption', () => {
      (window as any).speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      game = new NoButtonGame();
      game.init(canvas);

      const categories: Array<'basic' | 'greetings' | 'colors' | 'numbers'> = [
        'basic',
        'greetings',
        'colors',
        'numbers',
      ];

      // Rapidly flood 50 tab clicks
      for (let i = 0; i < 50; i++) {
        const cat = categories[i % categories.length];
        const tabBtn = document.getElementById(`tab-${cat}`) as HTMLButtonElement;
        tabBtn.click();
      }

      // Final active category should be categories[49 % 4] = categories[1] = 'greetings'
      expect(game.getCategory()).toBe('greetings');

      // Assert exactly 4 view containers exist in DOM (no duplicate appends)
      expect(document.querySelectorAll('.eeno-view').length).toBe(4);
      expect(document.getElementById('view-basic')?.classList.contains('hidden')).toBe(true);
      expect(document.getElementById('view-greetings')?.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('view-colors')?.classList.contains('hidden')).toBe(true);
      expect(document.getElementById('view-numbers')?.classList.contains('hidden')).toBe(true);

      // Assert cards in greetings view are still active and clickable
      const activeCard = document.querySelector('#view-greetings .eeno-word-card') as HTMLButtonElement;
      expect(activeCard).not.toBeNull();
      expect(() => activeCard.click()).not.toThrow();
    });

    it('verifies Quechua vocabulary integrity and authentic pronunciation triggers', () => {
      (window as any).speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      TranslationManager.setLanguage('qu-PE');
      game = new NoButtonGame();
      game.init(canvas);

      // Verify Basic (Yes = Arí, No = Manan)
      const yesBtn = document.getElementById('giant-yes-button') as HTMLButtonElement;
      const noBtn = document.getElementById('giant-no-button') as HTMLButtonElement;
      expect(yesBtn.textContent?.trim()).toBe('ARÍ');
      expect(noBtn.textContent?.trim()).toBe('MANAN');

      yesBtn.click();
      expect(speakAudioSpy).toHaveBeenCalledWith('Arí!', 'qu-PE', expect.any(Object));

      noBtn.click();
      expect(speakAudioSpy).toHaveBeenCalledWith('Manan.', 'qu-PE', expect.any(Object));

      // Verify Greetings: Allianllachu, Tupananchiskama, Allichu, Sulpayki
      game.setCategory('greetings');
      const greetingsContainer = document.getElementById('greetings-container');
      const greetingButtons = greetingsContainer?.querySelectorAll('.eeno-word-card');
      expect(greetingButtons?.length).toBe(4);

      const expectedGreetings = ['Allianllachu', 'Tupananchiskama', 'Allichu', 'Sulpayki'];
      greetingButtons?.forEach((btn, idx) => {
        const text = btn.querySelector('.eeno-card-text')?.textContent?.trim();
        expect(text).toBe(expectedGreetings[idx]);
        (btn as HTMLButtonElement).click();
        expect(speakAudioSpy).toHaveBeenCalledWith(expectedGreetings[idx], 'qu-PE', expect.any(Object));
      });

      // Verify Colors: Puka, Anqas, Q'illu, Q'umer
      game.setCategory('colors');
      const redCard = document.querySelector('.card-red .eeno-card-text');
      const blueCard = document.querySelector('.card-blue .eeno-card-text');
      const yellowCard = document.querySelector('.card-yellow .eeno-card-text');
      const greenCard = document.querySelector('.card-green .eeno-card-text');

      expect(redCard?.textContent?.trim()).toBe('Puka');
      expect(blueCard?.textContent?.trim()).toBe('Anqas');
      expect(yellowCard?.textContent?.trim()).toBe("Q'illu");
      expect(greenCard?.textContent?.trim()).toBe("Q'umer");

      // Verify Numbers: 1 to 10
      game.setCategory('numbers');
      const numberButtons = document.querySelectorAll('.eeno-number-btn');
      expect(numberButtons.length).toBe(10);
      const expectedNumbers = ['Huk', 'Iskay', 'Kimsa', 'Tawa', 'Pichqa', 'Suqta', 'Qanchis', 'Pusaq', 'Isqun', 'Chunka'];
      numberButtons.forEach((btn, idx) => {
        const wordText = btn.querySelector('.eeno-num-word')?.textContent?.trim();
        expect(wordText).toBe(expectedNumbers[idx]);
      });
    });

    it('verifies pitch, rate, and gender options are correctly propagated to AudioController.speak', () => {
      (window as any).speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      game = new NoButtonGame();
      game.init(canvas);

      // Select female gender
      const femaleBtn = document.getElementById('voice-gender-female') as HTMLButtonElement;
      femaleBtn.click();

      // Select low pitch (0.85)
      const lowPitchBtn = document.getElementById('pitch-low') as HTMLButtonElement;
      lowPitchBtn.click();

      // Select fast rate (1.3)
      const fastRateBtn = document.getElementById('speed-fast') as HTMLButtonElement;
      fastRateBtn.click();

      game.speakWord('Hello');
      expect(speakAudioSpy).toHaveBeenCalledWith('Hello', 'en-US', {
        gender: 'female',
        pitch: 0.85,
        rate: 1.3,
      });

      // Modulate to high pitch (1.25) and slow rate (0.8) and male
      const maleBtn = document.getElementById('voice-gender-male') as HTMLButtonElement;
      maleBtn.click();
      const highPitchBtn = document.getElementById('pitch-high') as HTMLButtonElement;
      highPitchBtn.click();
      const slowRateBtn = document.getElementById('speed-slow') as HTMLButtonElement;
      slowRateBtn.click();

      game.speakWord('Goodbye');
      expect(speakAudioSpy).toHaveBeenCalledWith('Goodbye', 'en-US', {
        gender: 'male',
        pitch: 1.25,
        rate: 0.8,
      });
    });
  });

  describe('2. Phase 3 Continuous Frame Rendering in update() (Feature 15 / Issue #15)', () => {
    it('executes 60 continuous frames of update(16.6) in SoundWaveStudioGame and asserts canvas 2D draw calls without calling render()', () => {
      const { canvas, ctx } = createMockCanvas(900, 600);
      const game = new SoundWaveStudioGame();
      game.init(canvas);

      ctx.clearRect.mockClear();
      ctx.fillRect.mockClear();
      ctx.stroke.mockClear();

      // Execute 60 frames of update(16.6) WITHOUT calling game.render() manually
      for (let f = 0; f < 60; f++) {
        game.update(16.6);
      }

      // Assert clearRect, fillRect, stroke were called on every frame
      expect(ctx.clearRect).toHaveBeenCalledTimes(60);
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(60);
      expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(60);

      game.destroy();
    });

    it('executes 60 continuous frames of update(16.6) in TypographyBoardGame and asserts canvas 2D draw calls without calling render()', () => {
      const { canvas, ctx } = createMockCanvas(900, 600);
      const game = new TypographyBoardGame();
      game.init(canvas);

      ctx.clearRect.mockClear();
      ctx.fillRect.mockClear();
      ctx.stroke.mockClear();

      // Execute 60 frames of update(16.6) WITHOUT calling game.render() manually
      for (let f = 0; f < 60; f++) {
        game.update(16.6);
      }

      expect(ctx.clearRect).toHaveBeenCalledTimes(60);
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(60);
      expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(60);

      game.destroy();
    });
  });

  describe('3. Phase 3 Boundary Release & Resize Torture (Feature 15 / Issue #15)', () => {
    describe('Pointer Boundary Releases (mouseleave & touchcancel)', () => {
      it('EquationTowerGame drops a block on a tray tap and takes it off on a tower tap', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new EquationTowerGame();
        game.init(canvas);

        const tile = (game as any).layout.tiles[0];
        canvas.dispatchEvent(new MouseEvent('pointerdown', {
          clientX: tile.x + tile.w / 2,
          clientY: tile.y + tile.h / 2,
          cancelable: true,
        }));
        const blocks = (game as any).blocks;
        expect(blocks.length).toBe(1);

        for (let f = 0; f < 120; f++) game.update(16.6);
        const L = (game as any).layout;
        canvas.dispatchEvent(new MouseEvent('pointerdown', {
          clientX: L.cx,
          clientY: L.baseY - L.unit / 2,
          cancelable: true,
        }));
        expect((game as any).blocks.length).toBe(0);

        game.destroy();
      });

      it('TrashSorcererGame immediately releases dragging item on touchcancel and mouseleave', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new TrashSorcererGame();
        game.init(canvas);

        // Spawn an item
        (game as any).spawnTrash();
        const items = (game as any).trashItems;
        expect(items.length).toBeGreaterThan(0);
        const targetItem = items[0];

        // Start dragging via touchstart
        const touchObj = {
          clientX: targetItem.body.position.x,
          clientY: targetItem.body.position.y,
        };
        const touchStartEvent = new Event('touchstart') as any;
        touchStartEvent.preventDefault = vi.fn();
        touchStartEvent.changedTouches = [touchObj];
        canvas.dispatchEvent(touchStartEvent);

        expect((game as any).draggingItem).not.toBeNull();

        // Fire touchcancel
        const touchCancelEvent = new Event('touchcancel') as any;
        touchCancelEvent.preventDefault = vi.fn();
        touchCancelEvent.changedTouches = [touchObj];
        canvas.dispatchEvent(touchCancelEvent);

        expect((game as any).draggingItem).toBeNull();

        // Start dragging via mousedown
        canvas.dispatchEvent(new MouseEvent('mousedown', {
          clientX: targetItem.body.position.x,
          clientY: targetItem.body.position.y,
        }));
        expect((game as any).draggingItem).not.toBeNull();

        // Fire mouseleave
        canvas.dispatchEvent(new MouseEvent('mouseleave', {
          clientX: targetItem.body.position.x,
          clientY: targetItem.body.position.y,
        }));
        expect((game as any).draggingItem).toBeNull();

        game.destroy();
      });
    });

    describe('Extreme Resize Boundary Torture ([2000, 200], [200, 2000], [0, 0], [1, 1])', () => {
      const resolutions: Array<[number, number]> = [
        [2000, 200], // Ultra wide banner
        [200, 2000], // Ultra tall tower
        [0, 0],       // Degenerate zero dimension
        [1, 1],       // Minimal 1px dimension
      ];

      it('tortures CloudShapeGame through extreme resize boundaries', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new CloudShapeGame();
        game.init(canvas);

        for (const [w, h] of resolutions) {
          expect(() => {
            canvas.width = w;
            canvas.height = h;
            game.resize(w, h);
            for (let f = 0; f < 5; f++) {
              game.update(16.6);
            }
          }).not.toThrow();

          // Verify all clouds have valid coordinates (no NaN, no Infinity)
          const clouds = game.getClouds();
          clouds.forEach(cloud => {
            expect(Number.isFinite(cloud.x)).toBe(true);
            expect(Number.isFinite(cloud.y)).toBe(true);
            expect(Number.isFinite(cloud.vx)).toBe(true);
            expect(Number.isFinite(cloud.vy)).toBe(true);
          });
        }

        game.destroy();
      });

      it('tortures AnimalChoirGame through extreme resize boundaries', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new AnimalChoirGame();
        game.init(canvas);

        for (const [w, h] of resolutions) {
          expect(() => {
            canvas.width = w;
            canvas.height = h;
            game.resize(w, h);
            for (let f = 0; f < 5; f++) {
              game.update(16.6);
            }
          }).not.toThrow();

          const grid = game.getGrid();
          grid.forEach(row => {
            row.forEach(node => {
              expect(Number.isFinite(node.bounceProgress)).toBe(true);
              expect(Number.isFinite(node.playHighlight)).toBe(true);
            });
          });
        }

        game.destroy();
      });

      it('tortures EquationTowerGame through extreme resize boundaries', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new EquationTowerGame();
        game.init(canvas);

        for (const [w, h] of resolutions) {
          expect(() => {
            canvas.width = w;
            canvas.height = h;
            game.resize(w, h);
            for (let f = 0; f < 5; f++) {
              game.update(16.6);
            }
          }).not.toThrow();

          const layout = (game as any).layout;
          if (layout) {
            expect(Number.isFinite(layout.baseY)).toBe(true);
            expect(Number.isFinite(layout.unit)).toBe(true);
          }
        }

        game.destroy();
      });

      it('tortures TrashSorcererGame through extreme resize boundaries', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new TrashSorcererGame();
        game.init(canvas);

        for (const [w, h] of resolutions) {
          expect(() => {
            canvas.width = w;
            canvas.height = h;
            game.resize(w, h);
            for (let f = 0; f < 5; f++) {
              game.update(16.6);
            }
          }).not.toThrow();

          const portals = (game as any).portals;
          portals.forEach((p: any) => {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
            if (p.sensorBody) {
              expect(Number.isFinite(p.sensorBody.position.x)).toBe(true);
              expect(Number.isFinite(p.sensorBody.position.y)).toBe(true);
            }
          });
        }

        game.destroy();
      });

      it('tortures VibeCoderGame through extreme resize boundaries', () => {
        const { canvas } = createMockCanvas(800, 600);
        const game = new VibeCoderGame();
        game.init(canvas);

        for (const [w, h] of resolutions) {
          expect(() => {
            canvas.width = w;
            canvas.height = h;
            game.resize(w, h);
            for (let f = 0; f < 5; f++) {
              game.update(16.6);
            }
          }).not.toThrow();
        }

        game.destroy();
      });
    });
  });
});
