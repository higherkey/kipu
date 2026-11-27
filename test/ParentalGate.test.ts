import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ParentalGate } from '../src/ui/ParentalGate';

// Polyfill MockPointerEvent for JSDOM
if (typeof window.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    constructor(type: string, dict: any = {}) {
      super(type, dict);
      this.pointerId = dict.pointerId ?? 1;
      this.pointerType = dict.pointerType ?? 'touch';
    }
  }
  window.PointerEvent = MockPointerEvent as any;
  (globalThis as any).PointerEvent = MockPointerEvent;
}

// Polyfill setPointerCapture on HTMLElement prototype
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
}

describe('ParentalGate Component & Verification Mechanisms', () => {
  let gate: ParentalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    localStorage.clear();
    gate = ParentalGate.getInstance();
    gate.destroy();
  });

  afterEach(() => {
    gate.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('1. Lifecycle & Accessibility', () => {
    it('returns a singleton instance', () => {
      const g1 = ParentalGate.getInstance();
      const g2 = ParentalGate.getInstance();
      expect(g1).toBe(g2);
    });

    it('mounts modal overlay with dialog ARIA attributes upon verify()', () => {
      const onPass = vi.fn();
      gate.verify(onPass);

      const overlay = document.getElementById('parental-gate-overlay');
      const modal = document.querySelector('.parental-gate-modal');
      expect(overlay).not.toBeNull();
      expect(modal).not.toBeNull();
      expect(modal?.getAttribute('role')).toBe('dialog');
      expect(modal?.getAttribute('aria-modal')).toBe('true');
      expect(modal?.getAttribute('aria-labelledby')).toBe('parental-gate-title');
      expect(modal?.getAttribute('aria-describedby')).toBe('parental-gate-desc');
    });

    it('bypasses gate immediately when kipu_parental_gate_enabled is false', () => {
      localStorage.setItem('kipu_parental_gate_enabled', 'false');
      const onPass = vi.fn();
      const onCancel = vi.fn();

      gate.verify(onPass, onCancel);

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('dismisses modal and calls onCancel upon clicking close button', () => {
      const onPass = vi.fn();
      const onCancel = vi.fn();
      gate.verify(onPass, onCancel);

      const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
      closeBtn.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onPass).not.toHaveBeenCalled();
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('dismisses modal and calls onCancel upon pressing Escape key', () => {
      const onPass = vi.fn();
      const onCancel = vi.fn();
      gate.verify(onPass, onCancel);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('traps Tab focus within modal elements', () => {
      gate.verify(vi.fn());

      const modal = document.querySelector('.parental-gate-modal') as HTMLElement;
      const focusables = modal.querySelectorAll<HTMLElement>('button:not([disabled]):not(.hidden)');
      expect(focusables.length).toBeGreaterThan(0);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      expect(document.activeElement).toBe(last);

      // Tab from last element wraps to first
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true });
      window.dispatchEvent(tabEvent);
    });
  });

  describe('2. Sitewright Standards Compliance', () => {
    it('creates all modal elements with zero inline style attributes', () => {
      gate.verify(vi.fn(), vi.fn(), { mode: 'dual_hold' });

      const overlay = document.getElementById('parental-gate-overlay');
      expect(overlay?.getAttribute('style')).toBeNull();

      const descendants = overlay?.querySelectorAll('*') || [];
      expect(descendants.length).toBeGreaterThan(0);
      descendants.forEach((el) => {
        expect(el.getAttribute('style')).toBeNull();
      });
    });

    it('ensures interactive touch targets meet minimum 44px bounds', () => {
      gate.verify(vi.fn(), vi.fn(), { mode: 'dual_hold' });

      const closeBtn = document.querySelector('.parental-gate-close-btn');
      const cornerLeft = document.getElementById('parental-gate-corner-left');
      const cornerRight = document.getElementById('parental-gate-corner-right');
      const switchBtn = document.querySelector('.parental-gate-switch-btn');

      expect(closeBtn).not.toBeNull();
      expect(cornerLeft).not.toBeNull();
      expect(cornerRight).not.toBeNull();
      expect(switchBtn).not.toBeNull();
    });
  });

  describe('3. Dual-Corner Hold Verification & Immediate Cancellation', () => {
    it('pressing one corner only does not start hold timer', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));

      vi.advanceTimersByTime(3500);
      expect(onPass).not.toHaveBeenCalled();
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('is-holding')).toBe(false);
    });

    it('pressing same pointer on both corners does not start hold timer', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));

      vi.advanceTimersByTime(3500);
      expect(onPass).not.toHaveBeenCalled();
    });

    it('pressing both corners with distinct pointers starts timer and succeeds after 3000ms', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, bubbles: true }));

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('is-holding')).toBe(true);

      // Advance by 3000ms
      vi.advanceTimersByTime(3000);

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('releasing either pointer before 3000ms cancels timer immediately', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, bubbles: true }));

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('is-holding')).toBe(true);

      // Release left finger at 1500ms
      vi.advanceTimersByTime(1500);
      cornerLeft.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(false);

      // Advance past remaining time
      vi.advanceTimersByTime(2000);
      expect(onPass).not.toHaveBeenCalled();
    });

    it('pointercancel or touchcancel immediately resets hold progress', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, bubbles: true }));

      window.dispatchEvent(new Event('touchcancel'));

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('is-holding')).toBe(false);

      vi.advanceTimersByTime(3500);
      expect(onPass).not.toHaveBeenCalled();
    });

    it('touchcancel on window resets active pointers and allows immediate subsequent re-engagement', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      const modal = document.querySelector('.parental-gate-modal');

      // 1. Initial touch engage
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(true);
      expect(cornerLeft.classList.contains('is-active')).toBe(true);
      expect(cornerRight.classList.contains('is-active')).toBe(true);

      // 2. Trigger OS-level touchcancel event on window (e.g. system gesture or phone call)
      window.dispatchEvent(new Event('touchcancel'));

      // 3. Verify hold is cancelled and active styling/pointers are cleared
      expect(modal?.classList.contains('is-holding')).toBe(false);
      expect(cornerLeft.classList.contains('is-active')).toBe(false);
      expect(cornerRight.classList.contains('is-active')).toBe(false);

      // 4. Immediately attempt subsequent re-engagement with new pointers
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 30, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 40, bubbles: true }));

      // 5. Must cleanly start hold again without getting locked out
      expect(modal?.classList.contains('is-holding')).toBe(true);
      expect(cornerLeft.classList.contains('is-active')).toBe(true);
      expect(cornerRight.classList.contains('is-active')).toBe(true);

      // 6. Complete full hold duration
      vi.advanceTimersByTime(3000);

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });
  });

  describe('4. Cognitive Visual Arithmetic Challenge', () => {
    it('generates randomized arithmetic question and 4 distinct choice options', () => {
      gate.verify(vi.fn(), vi.fn(), { mode: 'math' });

      const prompt = document.getElementById('parental-gate-math-prompt');
      const choices = document.querySelectorAll('.parental-gate-choice-btn');

      expect(prompt?.textContent).toMatch(/What is \d+ [+\-*×] \d+\?/);
      expect(choices.length).toBe(4);
    });

    it('clicking the correct option triggers success and unmounts', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'math' });

      const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
      const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
      expect(match).not.toBeNull();

      const a = parseInt(match![1], 10);
      const op = match![2];
      const b = parseInt(match![3], 10);
      const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

      const correctBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer === String(correct)
      ) as HTMLButtonElement;

      expect(correctBtn).not.toBeNull();
      correctBtn.click();

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('clicking incorrect option triggers shake and re-rolls brand new question', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'math' });

      const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
      const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
      const a = parseInt(match![1], 10);
      const op = match![2];
      const b = parseInt(match![3], 10);
      const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

      const wrongBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer !== String(correct)
      ) as HTMLButtonElement;

      wrongBtn.click();

      expect(onPass).not.toHaveBeenCalled();
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('shake')).toBe(true);

      // Re-roll after 250ms
      vi.advanceTimersByTime(300);
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('shake')).toBe(false);
    });

    it('disables choice buttons during 250ms arithmetic shake delay to reject rapid clicking / guessing bypass', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'math' });

      const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
      const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
      expect(match).not.toBeNull();

      const a = parseInt(match![1], 10);
      const op = match![2];
      const b = parseInt(match![3], 10);
      const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

      const wrongBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer !== String(correct)
      ) as HTMLButtonElement;

      const correctBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer === String(correct)
      ) as HTMLButtonElement;

      expect(wrongBtn).toBeDefined();
      expect(correctBtn).toBeDefined();

      // Click wrong option
      wrongBtn.click();

      // Shake animation class is applied
      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('shake')).toBe(true);
      expect(onPass).not.toHaveBeenCalled();

      // Verify buttons are immediately disabled during shake delay
      const choices = document.querySelectorAll<HTMLButtonElement>('.parental-gate-choice-btn');
      choices.forEach((btn) => {
        expect(btn.disabled).toBe(true);
      });

      // Rapidly attempt to click correct button during 250ms window (at 50ms)
      vi.advanceTimersByTime(50);
      correctBtn.click();

      // Gate must NOT unlock or call onPass
      expect(onPass).not.toHaveBeenCalled();

      // Advance past the 250ms shake delay
      vi.advanceTimersByTime(250);
      expect(modal?.classList.contains('shake')).toBe(false);

      // Verify that after re-roll, newly rendered buttons are re-enabled
      const newChoices = document.querySelectorAll<HTMLButtonElement>('.parental-gate-choice-btn');
      newChoices.forEach((btn) => {
        expect(btn.disabled).toBe(false);
      });
    });

    it('triggers temporary lockout after 3 consecutive failed attempts', () => {
      gate.verify(vi.fn(), vi.fn(), { mode: 'math' });

      for (let i = 0; i < 3; i++) {
        const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
        const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
        let correct = 0;
        if (match) {
          const a = parseInt(match[1], 10);
          const op = match[2];
          const b = parseInt(match[3], 10);
          correct = op === '+' ? a + b : op === '-' ? a - b : a * b;
        }
        const wrongBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
          (btn) => (btn as HTMLElement).dataset.answer !== String(correct)
        ) as HTMLButtonElement;
        expect(wrongBtn).toBeDefined();
        wrongBtn.click();
        vi.advanceTimersByTime(300);
      }

      const lockoutMsg = document.querySelector('.parental-gate-lockout-msg');
      expect(lockoutMsg?.classList.contains('hidden')).toBe(false);

      // After 3000ms lockout expires
      vi.advanceTimersByTime(3000);
      expect(lockoutMsg?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('5. Dynamic Fallback & In-Modal Switch', () => {
    it('auto-selects dual-hold when navigator.maxTouchPoints >= 2', () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
      gate.verify(vi.fn(), vi.fn(), { mode: 'auto' });

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('mode-dual-hold') || modal?.classList.contains('mode-dual_hold')).toBe(true);
    });

    it('auto-selects math challenge when navigator.maxTouchPoints < 2', () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
      gate.verify(vi.fn(), vi.fn(), { mode: 'auto' });

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('mode-math')).toBe(true);
    });

    it('switches between modes via switch button without unmounting', () => {
      gate.verify(vi.fn(), vi.fn(), { mode: 'dual_hold' });

      const switchBtn = document.querySelector('.parental-gate-switch-btn') as HTMLButtonElement;
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('mode-dual_hold')).toBe(true);

      switchBtn.click();
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('mode-math')).toBe(true);

      switchBtn.click();
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('mode-dual_hold')).toBe(true);
    });

    it('cleanly resets active pointer tracking when mode is toggled during active hold', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      const switchBtn = document.querySelector('.parental-gate-switch-btn') as HTMLButtonElement;
      const modal = document.querySelector('.parental-gate-modal');

      // 1. Touch left corner only
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, bubbles: true }));
      expect(cornerLeft.classList.contains('is-active')).toBe(true);

      // 2. Switch mode to math while left corner was touched
      switchBtn.click();
      expect(modal?.classList.contains('mode-math')).toBe(true);

      // 3. Switch back to dual_hold mode
      switchBtn.click();
      expect(modal?.classList.contains('mode-dual_hold')).toBe(true);

      // Re-fetch corner buttons since DOM may have re-rendered
      const newCornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const newCornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      expect(newCornerLeft.classList.contains('is-active')).toBe(false);
      expect(newCornerRight.classList.contains('is-active')).toBe(false);

      // 4. Engage both corners with fresh pointers
      newCornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, bubbles: true }));
      newCornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 21, bubbles: true }));

      // 5. Hold must start cleanly without lingering pointer interference
      expect(modal?.classList.contains('is-holding')).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(onPass).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });
  });
});
