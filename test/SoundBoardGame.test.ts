import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SoundBoardGame } from '../src/games/soundBoard/SoundBoardGame';
import { HapticController } from '../src/core/HapticController';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 390;
  canvas.height = 844;

  const ctxBase: Record<string, any> = {
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
    measureText: vi.fn(() => ({ width: 50 })),
  };

  const ctx = new Proxy(ctxBase, {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Return a no-op function for any canvas method not explicitly mocked
      target[prop as string] = vi.fn();
      return target[prop as string];
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });

  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  return canvas;
}

describe('SoundBoardGame', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;
  let game: SoundBoardGame;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vibrateMock = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    // Reset HapticController singleton
    (HapticController as any).instance = undefined;

    // Mock AudioContext as a proper constructor
    global.AudioContext = class MockAudioContext {
      destination = {};
      currentTime = 0;
      state = 'running';
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
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

    game = new SoundBoardGame();
    canvas = createMockCanvas();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
  });

  it('should initialize without errors', () => {
    expect(game).toBeDefined();
  });

  it('should render 9 sound pads on update', () => {
    expect(() => game.update(16)).not.toThrow();
  });

  it('should trigger haptic on pad tap', () => {
    // Simulate a click in the center of the canvas (should hit a pad)
    const event = new MouseEvent('mousedown', {
      clientX: 195,
      clientY: 422,
    });
    canvas.dispatchEvent(event);

    expect(vibrateMock).toHaveBeenCalled();
  });

  it('should pause and resume without errors', () => {
    game.pause();
    expect(() => game.update(16)).not.toThrow();

    game.resume();
    expect(() => game.update(16)).not.toThrow();
  });
});
