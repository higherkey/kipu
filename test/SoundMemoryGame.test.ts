import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SoundMemoryGame } from '../src/games/soundMemory/SoundMemoryGame';
import { AudioController } from '../src/core/AudioController';
import { HapticController } from '../src/core/HapticController';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;

  const ctx: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
  };

  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
  });

  return canvas;
}

describe('SoundMemoryGame', () => {
  let game: SoundMemoryGame;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    vi.spyOn(HapticController.prototype, 'lightTap').mockImplementation(() => {});

    game = new SoundMemoryGame();
    canvas = createMockCanvas();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
    vi.useRealTimers();
  });

  it('should initialize 4 sound buttons and start at level 1', () => {
    expect(game).toBeDefined();
    expect((game as any).buttons.length).toBe(4);
    expect((game as any).level).toBe(1);
    expect((game as any).sequence.length).toBe(1);
  });

  it('should transition to play phase after sequence playback', () => {
    game.update(16);
    expect((game as any).phase).toBe('wait');

    vi.advanceTimersByTime(2000);
    expect((game as any).phase).toBe('play');
  });

  it('should advance to next round when player matches sequence', () => {
    (game as any).phase = 'play';
    const expectedTarget = (game as any).sequence[0];
    const button = (game as any).buttons[expectedTarget];

    (game as any).handleButtonPress(button.x, button.y);
    vi.advanceTimersByTime(200);

    expect((game as any).phase).toBe('won');
  });

  it('should auto-recover and replay round after wrong button press', () => {
    (game as any).phase = 'play';
    const correctTarget = (game as any).sequence[0];
    const wrongTarget = (correctTarget + 1) % 4;
    const button = (game as any).buttons[wrongTarget];

    (game as any).handleButtonPress(button.x, button.y);
    expect((game as any).phase).toBe('lost');

    // Advancing timers beyond auto-retry delay triggers replay
    vi.advanceTimersByTime(1400);
    expect((game as any).phase).toBe('show');
  });

  it('should immediately restart round if player taps canvas while lost', () => {
    (game as any).phase = 'play';
    const correctTarget = (game as any).sequence[0];
    const wrongTarget = (correctTarget + 1) % 4;
    const button = (game as any).buttons[wrongTarget];

    (game as any).handleButtonPress(button.x, button.y);
    expect((game as any).phase).toBe('lost');

    // Player taps canvas while lost
    (game as any).onInteractionAt(100, 100);
    expect((game as any).phase).toBe('show');
    expect((game as any).playerSequence.length).toBe(0);
  });

  it('should validate inputs synchronously on rapid taps without index corruption', () => {
    (game as any).phase = 'play';
    (game as any).sequence = [0, 1, 2];
    (game as any).playerSequence = [];

    // Tap first correct note
    const b0 = (game as any).buttons[0];
    (game as any).handleButtonPress(b0.x, b0.y);
    expect((game as any).playerSequence.length).toBe(1);
    expect((game as any).phase).toBe('play');

    // Tap second correct note immediately without waiting for timers
    const b1 = (game as any).buttons[1];
    (game as any).handleButtonPress(b1.x, b1.y);
    expect((game as any).playerSequence.length).toBe(2);
    expect((game as any).phase).toBe('play');

    // Tap third correct note
    const b2 = (game as any).buttons[2];
    (game as any).handleButtonPress(b2.x, b2.y);
    expect((game as any).playerSequence.length).toBe(3);
    expect((game as any).phase).toBe('won');
  });

  it('should recalculate button layout when canvas is resized', () => {
    const originalX = (game as any).buttons[0].x;
    canvas.width = 400;
    canvas.height = 300;

    game.resize(400, 300);

    const newX = (game as any).buttons[0].x;
    expect(newX).not.toBe(originalX);
    expect((game as any).buttons[0].radius).toBeGreaterThanOrEqual(44);
  });

  it('should handle interaction event and activate button', () => {
    (game as any).phase = 'play';
    const target = (game as any).sequence[0];
    const button = (game as any).buttons[target];

    canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: button.x,
      clientY: button.y,
    }));

    expect((game as any).playerSequence.length).toBe(1);
  });

  it('should support pause and resume lifecycle', () => {
    game.pause();
    expect((game as any).isPaused).toBe(true);

    game.resume();
    expect((game as any).isPaused).toBe(false);
  });

  it('should clear active timeouts and particles on destroy', () => {
    game.destroy();
    expect((game as any).activeTimeouts.length).toBe(0);
    expect((game as any).particles.length).toBe(0);
  });
});
