import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HapticController } from '../src/core/HapticController';

describe('HapticController', () => {
  beforeEach(() => {
    (HapticController as any).instance = undefined;
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => true),
      writable: true,
      configurable: true,
    });
    localStorage.removeItem('vibrationEnabled');
    localStorage.removeItem('soundEnabled');
  });

  afterEach(() => {
    document.querySelectorAll('.haptic-switch-fallback, .haptic-label-fallback').forEach(el => el.remove());
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

  it('vibrate should call navigator.vibrate with duration', () => {
    const haptics = HapticController.getInstance();
    haptics.vibrate(150);
    expect(navigator.vibrate).toHaveBeenCalledWith(150);
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

  it('should fallback to switch click when navigator.vibrate is undefined', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const haptics = HapticController.getInstance();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    const labelSpy = vi.spyOn(HTMLLabelElement.prototype, 'click');
    haptics.lightTap();
    expect(labelSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    labelSpy.mockRestore();
  });

  it('should create switch element with correct attributes and class without inline style', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const haptics = HapticController.getInstance();
    haptics.lightTap();
    const switchEl = document.querySelector('input.haptic-switch-fallback') as HTMLInputElement;
    expect(switchEl).not.toBeNull();
    expect(switchEl.type).toBe('checkbox');
    expect(switchEl.id).toBe('haptic-switch-fallback');
    expect(switchEl.hasAttribute('switch')).toBe(true);
    expect(switchEl.tabIndex).toBe(-1);
    expect(switchEl.getAttribute('aria-hidden')).toBe('true');
    expect(switchEl.getAttribute('style')).toBeNull();

    const labelEl = document.querySelector('label.haptic-label-fallback') as HTMLLabelElement;
    expect(labelEl).not.toBeNull();
    expect(labelEl.htmlFor).toBe('haptic-switch-fallback');
    expect(labelEl.getAttribute('aria-hidden')).toBe('true');
    expect(labelEl.getAttribute('style')).toBeNull();
  });

  it('should unlock audio context on initial pointer interaction', () => {
    const haptics = HapticController.getInstance();
    expect(() => haptics.unlockAudioContext()).not.toThrow();
  });

  it('should not throw unhandled promise rejection on any method', async () => {
    const haptics = HapticController.getInstance();
    await expect(haptics.lightTap()).resolves.toBeUndefined();
    await expect(haptics.heavyImpact()).resolves.toBeUndefined();
    await expect(haptics.vibrate(100)).resolves.toBeUndefined();
    await expect(haptics.success()).resolves.toBeUndefined();
  });

  it('should respect vibrationEnabled setting', () => {
    localStorage.setItem('vibrationEnabled', 'false');
    const haptics = HapticController.getInstance();
    haptics.lightTap();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });
});
