import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ParticlePhysicsGame } from '../src/games/particlePhysics/ParticlePhysicsGame';
import { HapticController } from '../src/core/HapticController';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 390;
  canvas.height = 844;

  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  return canvas;
}

describe('ParticlePhysicsGame', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;
  let game: ParticlePhysicsGame;
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

    game = new ParticlePhysicsGame();
    canvas = createMockCanvas();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
  });

  it('should trigger haptic on initial mousedown', () => {
    const event = new MouseEvent('mousedown', { clientX: 200, clientY: 400 });
    canvas.dispatchEvent(event);

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(20);
  });

  it('should trigger haptic on initial touchstart', () => {
    const event = new TouchEvent('touchstart', {
      changedTouches: [{ identifier: 0, clientX: 200, clientY: 400, target: canvas } as any],
    });
    canvas.dispatchEvent(event);

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(20);
  });

  it('should trigger continuous haptic pulses during drag', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    // Simulate mousedown
    const downEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 400 });
    canvas.dispatchEvent(downEvent);
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    // Simulate continuous drag by advancing time with update calls
    // The haptic interval is 80ms, so calling update for ~1000ms should produce ~12 additional pulses
    for (let i = 0; i < 60; i++) {
      now += 16.67; // ~60fps
      game.update(16.67);
    }

    // 1 initial + continuous pulses during ~1000ms at 80ms interval ≈ 12-13 pulses
    // Total should be >= 10
    expect(vibrateMock.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('should NOT trigger continuous haptic when pointer is not down', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    // No mousedown, just call update
    for (let i = 0; i < 60; i++) {
      now += 16.67;
      game.update(16.67);
    }

    // No haptic should fire since pointer is not down
    expect(vibrateMock).toHaveBeenCalledTimes(0);
  });

  it('should stop haptic after mouseup', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    // Mousedown
    const downEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 400 });
    canvas.dispatchEvent(downEvent);

    // A few updates while pointer is down (enough to trigger some haptics)
    for (let i = 0; i < 10; i++) {
      now += 16.67;
      game.update(16.67);
    }

    const callsBeforeUp = vibrateMock.mock.calls.length;
    expect(callsBeforeUp).toBeGreaterThan(1);

    // Mouseup
    const upEvent = new MouseEvent('mouseup');
    canvas.dispatchEvent(upEvent);

    // More updates after mouseup
    for (let i = 0; i < 30; i++) {
      now += 16.67;
      game.update(16.67);
    }

    // No additional haptic calls after mouseup
    expect(vibrateMock.mock.calls.length).toBe(callsBeforeUp);
  });

  it('should not double-pulse on initial touch (lastHapticTime prevents it)', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    // Mousedown at time=1000
    const downEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 400 });
    canvas.dispatchEvent(downEvent);
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    // Immediately call update (within 80ms window)
    now += 16;
    game.update(16);

    // Should still be 1 call since we're within the 80ms throttle window
    expect(vibrateMock).toHaveBeenCalledTimes(1);

    // Advance past throttle interval
    now += 80;
    game.update(16);

    // Now should have 2 calls
    expect(vibrateMock).toHaveBeenCalledTimes(2);
  });
});
