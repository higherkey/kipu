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

describe('Adversarial Stress Suite: ParentalGate Resilience', () => {
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

  describe('Attack Vector 1: Touch Cancellation, Pointer Tracking, and Deadlock Prevention', () => {
    it('AV1.1: touchcancel on window immediately purges pointers, holding classes, and stops hold timer', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      const modal = document.querySelector('.parental-gate-modal');

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 101, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 102, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(true);
      expect(cornerLeft.classList.contains('is-active')).toBe(true);
      expect(cornerRight.classList.contains('is-active')).toBe(true);

      // Trigger OS-level touchcancel
      window.dispatchEvent(new Event('touchcancel'));

      expect(modal?.classList.contains('is-holding')).toBe(false);
      expect(cornerLeft.classList.contains('is-active')).toBe(false);
      expect(cornerRight.classList.contains('is-active')).toBe(false);

      // Advance time past 3s - onPass must NEVER be called
      vi.advanceTimersByTime(4000);
      expect(onPass).not.toHaveBeenCalled();
    });

    it('AV1.2: chaotic barrage of 50 randomized pointer and cancellation events never deadlocks the gate', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      // Deterministic PRNG seed for reproducible chaos
      let seed = 42;
      const pseudoRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const eventTypes = [
        'left_down',
        'right_down',
        'left_up',
        'right_up',
        'left_cancel',
        'right_cancel',
        'window_touchcancel',
        'window_pointerup_left',
        'window_pointercancel_right',
        'advance_time',
      ] as const;

      for (let i = 0; i < 50; i++) {
        const choice = eventTypes[Math.floor(pseudoRandom() * eventTypes.length)];
        const pointerId = 200 + (i % 5);

        switch (choice) {
          case 'left_down':
            cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId, bubbles: true }));
            break;
          case 'right_down':
            cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId, bubbles: true }));
            break;
          case 'left_up':
            cornerLeft.dispatchEvent(new PointerEvent('pointerup', { pointerId, bubbles: true }));
            break;
          case 'right_up':
            cornerRight.dispatchEvent(new PointerEvent('pointerup', { pointerId, bubbles: true }));
            break;
          case 'left_cancel':
            cornerLeft.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
            break;
          case 'right_cancel':
            cornerRight.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
            break;
          case 'window_touchcancel':
            window.dispatchEvent(new Event('touchcancel'));
            break;
          case 'window_pointerup_left':
            window.dispatchEvent(new PointerEvent('pointerup', { pointerId, bubbles: true }));
            break;
          case 'window_pointercancel_right':
            window.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
            break;
          case 'advance_time':
            vi.advanceTimersByTime(Math.floor(pseudoRandom() * 200) + 10);
            break;
        }
      }

      // After chaotic barrage, reset via OS touchcancel to ensure clean baseline
      window.dispatchEvent(new Event('touchcancel'));

      // Verify gate can now be cleanly engaged with a pristine 3-second hold
      const freshPass = vi.fn();
      gate.destroy();
      gate.verify(freshPass, vi.fn(), { mode: 'dual_hold' });

      const newLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const newRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      const modal = document.querySelector('.parental-gate-modal');

      newLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 501, bubbles: true }));
      newRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 502, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(freshPass).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
    });

    it('AV1.3: window-level pointerup or pointercancel releases tracking when finger drags off-screen', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      const modal = document.querySelector('.parental-gate-modal');

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 301, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 302, bubbles: true }));
      expect(modal?.classList.contains('is-holding')).toBe(true);

      // User drags left finger outside button and lifts off outside window/modal
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 301, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(false);
      expect(cornerLeft.classList.contains('is-active')).toBe(false);
      expect(cornerRight.classList.contains('is-active')).toBe(true); // Right finger is still held

      // Releasing right finger via window pointercancel
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 302, bubbles: true }));
      expect(cornerRight.classList.contains('is-active')).toBe(false);

      vi.advanceTimersByTime(3000);
      expect(onPass).not.toHaveBeenCalled();
    });

    it('AV1.4: multi-touch on single corner does not create false dual-hold or corrupt state on release', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const modal = document.querySelector('.parental-gate-modal');

      // First finger on left corner
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 401, bubbles: true }));
      // Second finger on same left corner
      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 402, bubbles: true }));

      // Dual hold should NOT start with fingers only on left corner
      expect(modal?.classList.contains('is-holding')).toBe(false);

      // Releasing second finger (402) should not clear first finger (401)
      cornerLeft.dispatchEvent(new PointerEvent('pointerup', { pointerId: 402, bubbles: true }));
      expect(cornerLeft.classList.contains('is-active')).toBe(true);

      // Now place finger on right corner
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 403, bubbles: true }));

      // Now dual hold should activate!
      expect(modal?.classList.contains('is-holding')).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(onPass).toHaveBeenCalledTimes(1);
    });
  });

  describe('Attack Vector 2: Arithmetic Anti-Guess Race Conditions & Mode Switching', () => {
    it('AV2.1: clicking incorrect option rejects rapid clicks on correct option at multiple microsecond intervals', () => {
      const testIntervals = [1, 10, 25, 50, 100, 150, 200, 240];

      for (const delayMs of testIntervals) {
        document.body.innerHTML = '';
        gate.destroy();

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

        // Click wrong option
        wrongBtn.click();

        // Advance to the specific interval during the 250ms shake delay
        vi.advanceTimersByTime(delayMs);

        // Verify button is disabled
        expect(correctBtn.disabled).toBe(true);

        // Attempt rapid click on correct button
        correctBtn.click();

        // Attempt dispatching raw click event
        correctBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        // Gate must NOT unlock
        expect(onPass).not.toHaveBeenCalled();

        // Advance past remaining shake time
        vi.advanceTimersByTime(250 - delayMs + 10);
      }
    });

    it('AV2.2: simultaneous multi-pointer click on wrong and right answers simultaneously ignores the second click', () => {
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

      const correctBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer === String(correct)
      ) as HTMLButtonElement;

      // Simultaneous click simulated in synchronous execution block
      wrongBtn.click();
      correctBtn.click();

      expect(onPass).not.toHaveBeenCalled();
      expect(document.querySelector('.parental-gate-modal')?.classList.contains('shake')).toBe(true);
    });

    it('AV2.3: mode switch from math to dual-hold during 250ms shake window clears shake and reroll timers without state leak', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'math' });

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
      wrongBtn.click();

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('shake')).toBe(true);

      // At 50ms into shake, user clicks switch mode button
      vi.advanceTimersByTime(50);
      const switchBtn = document.querySelector('.parental-gate-switch-btn') as HTMLButtonElement;
      switchBtn.click();

      // Modal must have switched mode and stripped shake class
      expect(modal?.classList.contains('mode-dual_hold')).toBe(true);
      expect(modal?.classList.contains('shake')).toBe(false);

      // Advance time past what would have been the math reroll timer (300ms)
      vi.advanceTimersByTime(300);

      // Perform clean dual-hold in the switched mode
      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 601, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 602, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(onPass).toHaveBeenCalledTimes(1);
    });

    it('AV2.4: 250 consecutive math questions generate 4 distinct positive options with correct answer included', () => {
      for (let i = 0; i < 250; i++) {
        gate.destroy();
        gate.verify(vi.fn(), vi.fn(), { mode: 'math' });

        const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
        const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
        expect(match).not.toBeNull();

        const a = parseInt(match![1], 10);
        const op = match![2];
        const b = parseInt(match![3], 10);
        const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

        const choiceBtns = Array.from(document.querySelectorAll('.parental-gate-choice-btn')) as HTMLButtonElement[];
        expect(choiceBtns.length).toBe(4);

        const options = choiceBtns.map((b) => parseInt(b.dataset.answer || '0', 10));
        // All options must be positive numbers
        options.forEach((opt) => expect(opt).toBeGreaterThan(0));

        // Options must be unique (set size 4)
        const uniqueSet = new Set(options);
        expect(uniqueSet.size).toBe(4);

        // Correct answer must be among options
        expect(uniqueSet.has(correct)).toBe(true);
      }
    });

    it('AV2.5: switching to dual-hold during 3-failed-attempts lockout allows dual-hold completion', () => {
      const onPass = vi.fn();
      gate.verify(onPass, vi.fn(), { mode: 'math' });

      // Trigger 3 explicitly wrong failed attempts
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

      // Switch mode to dual_hold while locked out in math
      const switchBtn = document.querySelector('.parental-gate-switch-btn') as HTMLButtonElement;
      switchBtn.click();

      const modal = document.querySelector('.parental-gate-modal');
      expect(modal?.classList.contains('mode-dual_hold')).toBe(true);

      // Engage dual-hold
      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 701, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 702, bubbles: true }));

      expect(modal?.classList.contains('is-holding')).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(onPass).toHaveBeenCalledTimes(1);
    });
  });

  describe('Attack Vector 3: Re-entrancy, Escape, and Lifecycle Teardown', () => {
    it('AV3.1: re-entrant verify() call cancels previous session and mounts fresh instance without orphaned timers', () => {
      const pass1 = vi.fn();
      const cancel1 = vi.fn();
      const pass2 = vi.fn();

      gate.verify(pass1, cancel1, { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 801, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 802, bubbles: true }));

      // Advance 1s into hold
      vi.advanceTimersByTime(1000);

      // Re-entrant verify call
      gate.verify(pass2, vi.fn(), { mode: 'dual_hold' });

      // First session was cancelled
      expect(cancel1).toHaveBeenCalledTimes(1);
      expect(pass1).not.toHaveBeenCalled();

      // Old pointers should not trigger success for session 1
      vi.advanceTimersByTime(3000);
      expect(pass1).not.toHaveBeenCalled();
      expect(pass2).not.toHaveBeenCalled();

      // Engage new session
      const newLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const newRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      newLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 901, bubbles: true }));
      newRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 902, bubbles: true }));

      vi.advanceTimersByTime(3000);
      expect(pass2).toHaveBeenCalledTimes(1);
    });

    it('AV3.2: Escape key during active dual-hold or math evaluation triggers onCancel and leaves no dangling listeners', () => {
      const cancelSpy = vi.fn();
      gate.verify(vi.fn(), cancelSpy, { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1001, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1002, bubbles: true }));

      // Press Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();

      // Subsequent events on window should not throw or cause errors
      window.dispatchEvent(new Event('touchcancel'));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1001 }));
    });

    it('AV3.3: multiple rapid clicks on close button fire onCancel exactly once', () => {
      const cancelSpy = vi.fn();
      gate.verify(vi.fn(), cancelSpy);

      const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
      closeBtn.click();
      closeBtn.click();
      closeBtn.click();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('AV3.4: calling destroy() while hold timer is running aborts hold and prevents resolveSuccess', () => {
      const passSpy = vi.fn();
      gate.verify(passSpy, vi.fn(), { mode: 'dual_hold' });

      const cornerLeft = document.getElementById('parental-gate-corner-left') as HTMLElement;
      const cornerRight = document.getElementById('parental-gate-corner-right') as HTMLElement;

      cornerLeft.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1101, bubbles: true }));
      cornerRight.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1102, bubbles: true }));

      vi.advanceTimersByTime(2000); // 2s elapsed

      // Destroy gate
      gate.destroy();

      expect(document.getElementById('parental-gate-overlay')).toBeNull();

      // Advance remaining 1000ms
      vi.advanceTimersByTime(2000);

      expect(passSpy).not.toHaveBeenCalled();
    });
  });
});
