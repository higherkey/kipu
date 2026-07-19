import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HapticController } from '../src/core/HapticController';

describe('HapticController', () => {
  beforeEach(() => {
    (HapticController as any).instance = undefined;
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => true),
      writable: true,
      configurable: true,
    });
  });

  it('should be a singleton', () => {
    const a = HapticController.getInstance();
    const b = HapticController.getInstance();
    expect(a).toBe(b);
  });

  it('lightTap should call navigator.vibrate with 20ms', () => {
    const haptics = HapticController.getInstance();
    haptics.lightTap();
    expect(navigator.vibrate).toHaveBeenCalledWith(20);
  });

  it('heavyImpact should call navigator.vibrate with 50ms', () => {
    const haptics = HapticController.getInstance();
    haptics.heavyImpact();
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('success should call navigator.vibrate with pattern', () => {
    const haptics = HapticController.getInstance();
    haptics.success();
    expect(navigator.vibrate).toHaveBeenCalledWith([30, 50, 30]);
  });

  it('should not throw if navigator.vibrate is undefined', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const haptics = HapticController.getInstance();
    expect(() => haptics.lightTap()).not.toThrow();
  });
});
