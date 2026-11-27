import { Icons } from './Icons';
import { HapticController } from '../core/HapticController';
import { AudioController } from '../core/AudioController';
import './ParentalGate.css';

export type ParentalGateMode = 'auto' | 'dual_hold' | 'math' | 'dual-hold';

export interface ParentalGateOptions {
  mode?: ParentalGateMode;
  holdDurationMs?: number; // default: 3000
  title?: string;
  subtitle?: string;
}

export interface MathQuestion {
  prompt: string;
  correctAnswer: number;
  options: number[];
}

export class ParentalGate {
  private static instance: ParentalGate;

  // DOM Elements
  private overlayElement: HTMLElement | null = null;
  private modalElement: HTMLElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private cornerLeftBtn: HTMLElement | null = null;
  private cornerRightBtn: HTMLElement | null = null;
  private countdownText: HTMLElement | null = null;
  private mathContainer: HTMLElement | null = null;
  private switchModeBtn: HTMLButtonElement | null = null;
  private previousActiveElement: HTMLElement | null = null;

  // State
  private isOpen = false;
  private activeMode: 'dual_hold' | 'math' = 'dual_hold';
  private holdDurationMs = 3000;
  private onSuccessCallback: (() => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  // Pointer Tracking
  private activePointerLeft: number | null = null;
  private activePointerRight: number | null = null;
  private isHolding = false;
  private holdStartTime = 0;
  private holdTimerId: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: number | null = null;

  // Math State
  private currentQuestion: MathQuestion | null = null;
  private failedAttempts = 0;
  private isLockedOut = false;
  private isEvaluating = false;
  private lockoutTimerId: ReturnType<typeof setTimeout> | null = null;
  private shakeTimerId: ReturnType<typeof setTimeout> | null = null;
  private mathRerollTimerId: ReturnType<typeof setTimeout> | null = null;

  // Bound listeners
  private readonly boundWindowPointerUp = (e: PointerEvent) => this.handleWindowPointerRelease(e);
  private readonly boundWindowPointerCancel = (e: PointerEvent) => this.handleWindowPointerRelease(e);
  private readonly boundWindowTouchCancel = () => {
    this.resetPointers();
    this.cancelHold();
  };
  private readonly boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);

  private constructor() {}

  public static getInstance(): ParentalGate {
    if (!ParentalGate.instance) {
      ParentalGate.instance = new ParentalGate();
    }
    return ParentalGate.instance;
  }

  public isVerifying(): boolean {
    return this.isOpen;
  }

  public verify(
    onSuccess: () => void,
    onCancel?: () => void,
    options?: ParentalGateOptions
  ): void {
    // Check if parental gate is disabled in settings
    if (typeof localStorage !== 'undefined' && localStorage.getItem('kipu_parental_gate_enabled') === 'false') {
      onSuccess();
      return;
    }

    if (this.isOpen) {
      this.cancel();
    }

    this.onSuccessCallback = onSuccess;
    this.onCancelCallback = onCancel ?? null;
    this.holdDurationMs = options?.holdDurationMs ?? 3000;
    this.failedAttempts = 0;
    this.isLockedOut = false;

    // Determine initial mode
    const storedMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('kipu_parental_gate_mode') as ParentalGateMode) : null;
    let requestedMode: ParentalGateMode = options?.mode || storedMode || 'auto';
    if (requestedMode === 'dual-hold') requestedMode = 'dual_hold';

    if (requestedMode === 'auto') {
      const supportsMultiTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) >= 2;
      this.activeMode = supportsMultiTouch ? 'dual_hold' : 'math';
    } else {
      this.activeMode = requestedMode === 'dual_hold' ? 'dual_hold' : 'math';
    }

    this.mount(options?.title, options?.subtitle);
  }

  public cancel(): void {
    if (!this.isOpen) return;
    const cancelCb = this.onCancelCallback;
    this.unmount();
    cancelCb?.();
  }

  private resolveSuccess(): void {
    const successCb = this.onSuccessCallback;
    try {
      HapticController.getInstance().success();
    } catch (_) {}
    try {
      AudioController.getInstance().play('synth:chime', 'c5');
    } catch (_) {}
    this.unmount();
    successCb?.();
  }

  private mount(customTitle?: string, customSubtitle?: string): void {
    this.previousActiveElement = (document.activeElement as HTMLElement) || null;
    this.isOpen = true;

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'parental-gate-overlay';
    this.overlayElement.className = 'parental-gate-overlay';
    this.overlayElement.setAttribute('role', 'presentation');

    this.modalElement = document.createElement('div');
    this.modalElement.className = `parental-gate-modal mode-${this.activeMode} mode-${this.activeMode.replace('_', '-')}`;
    this.modalElement.setAttribute('role', 'dialog');
    this.modalElement.setAttribute('aria-modal', 'true');
    this.modalElement.setAttribute('aria-labelledby', 'parental-gate-title');
    this.modalElement.setAttribute('aria-describedby', 'parental-gate-desc');
    this.modalElement.tabIndex = -1;

    this.renderModalContent(customTitle, customSubtitle);
    this.overlayElement.appendChild(this.modalElement);
    document.body.appendChild(this.overlayElement);

    // Attach window safety listeners
    window.addEventListener('pointerup', this.boundWindowPointerUp);
    window.addEventListener('pointercancel', this.boundWindowPointerCancel);
    window.addEventListener('touchcancel', this.boundWindowTouchCancel);
    window.addEventListener('keydown', this.boundKeyDown);

    // Set initial focus
    this.closeButton?.focus();
  }

  private renderModalContent(customTitle?: string, customSubtitle?: string): void {
    if (!this.modalElement) return;

    const titleText = customTitle ?? 'Grown-Ups Only';
    const subtitleText = customSubtitle ?? (
      this.activeMode === 'dual_hold'
        ? 'Touch and hold both circles for 3 seconds to continue.'
        : 'Please solve this math question to continue.'
    );

    this.modalElement.innerHTML = `
      <div class="parental-gate-header">
        <div class="parental-gate-titles">
          <h2 id="parental-gate-title" class="parental-gate-title">${titleText}</h2>
          <p id="parental-gate-desc" class="parental-gate-desc">${subtitleText}</p>
        </div>
        <button class="parental-gate-close-btn" type="button" aria-label="Cancel and return">
          <span class="parental-gate-icon">${Icons.close}</span>
        </button>
      </div>

      <div class="parental-gate-challenge-container">
        <!-- Dual Hold Challenge View -->
        <div class="parental-gate-hold-view ${this.activeMode === 'dual_hold' ? '' : 'hidden'}">
          <div class="parental-gate-progress-wrap" aria-hidden="true">
            <svg class="parental-gate-progress-ring" viewBox="0 0 120 120">
              <circle class="progress-ring-track" cx="60" cy="60" r="50" stroke-width="8"></circle>
              <circle class="progress-ring-indicator" cx="60" cy="60" r="50" stroke-width="8" stroke-dasharray="314.16" stroke-dashoffset="314.16"></circle>
            </svg>
            <div class="parental-gate-countdown-text">3s</div>
          </div>
          <div class="parental-gate-corners-row">
            <button id="parental-gate-corner-left" class="parental-gate-corner-btn" type="button" aria-label="Hold target left">
              <span class="corner-label">1</span>
            </button>
            <button id="parental-gate-corner-right" class="parental-gate-corner-btn" type="button" aria-label="Hold target right">
              <span class="corner-label">2</span>
            </button>
          </div>
        </div>

        <!-- Cognitive Math Challenge View -->
        <div class="parental-gate-math-view ${this.activeMode === 'math' ? '' : 'hidden'}">
          <div class="parental-gate-math-question" id="parental-gate-math-prompt"></div>
          <div class="parental-gate-math-grid" role="group" aria-label="Math answer options"></div>
          <div class="parental-gate-lockout-msg hidden" aria-live="polite">Please wait 3 seconds...</div>
        </div>
      </div>

      <div class="parental-gate-footer">
        <button class="parental-gate-switch-btn" type="button">
          ${this.activeMode === 'dual_hold' ? 'Try math question instead' : 'Use touch hold gesture instead'}
        </button>
      </div>
    `;

    // Cache elements
    this.closeButton = this.modalElement.querySelector('.parental-gate-close-btn');
    this.cornerLeftBtn = this.modalElement.querySelector('#parental-gate-corner-left');
    this.cornerRightBtn = this.modalElement.querySelector('#parental-gate-corner-right');
    this.countdownText = this.modalElement.querySelector('.parental-gate-countdown-text');
    this.mathContainer = this.modalElement.querySelector('.parental-gate-math-view');
    this.switchModeBtn = this.modalElement.querySelector('.parental-gate-switch-btn');

    // Event binding
    this.closeButton?.addEventListener('click', () => this.cancel());
    this.switchModeBtn?.addEventListener('click', () => this.switchMode());

    if (this.activeMode === 'dual_hold') {
      this.bindCornerEvents();
    } else {
      this.setupMathQuestion();
    }
  }

  public resetPointers(): void {
    this.activePointerLeft = null;
    this.activePointerRight = null;
    this.cornerLeftBtn?.classList.remove('is-active');
    this.cornerRightBtn?.classList.remove('is-active');
  }

  public switchMode(targetMode?: 'dual_hold' | 'math'): void {
    this.resetPointers();
    this.cancelHold();
    this.isEvaluating = false;

    if (this.shakeTimerId !== null) {
      clearTimeout(this.shakeTimerId);
      this.shakeTimerId = null;
      this.modalElement?.classList.remove('shake');
    }
    if (this.mathRerollTimerId !== null) {
      clearTimeout(this.mathRerollTimerId);
      this.mathRerollTimerId = null;
    }

    if (targetMode) {
      this.activeMode = targetMode;
    } else {
      this.activeMode = this.activeMode === 'dual_hold' ? 'math' : 'dual_hold';
    }

    this.modalElement?.classList.remove('mode-dual_hold', 'mode-dual-hold', 'mode-math');
    this.modalElement?.classList.add(`mode-${this.activeMode}`, `mode-${this.activeMode.replace('_', '-')}`);

    const holdView = this.modalElement?.querySelector('.parental-gate-hold-view');
    const mathView = this.modalElement?.querySelector('.parental-gate-math-view');
    const desc = this.modalElement?.querySelector('#parental-gate-desc');

    if (this.activeMode === 'dual_hold') {
      holdView?.classList.remove('hidden');
      mathView?.classList.add('hidden');
      if (desc) desc.textContent = 'Touch and hold both circles for 3 seconds to continue.';
      if (this.switchModeBtn) this.switchModeBtn.textContent = 'Try math question instead';
      this.bindCornerEvents();
    } else {
      holdView?.classList.add('hidden');
      mathView?.classList.remove('hidden');
      if (desc) desc.textContent = 'Please solve this math question to continue.';
      if (this.switchModeBtn) this.switchModeBtn.textContent = 'Use touch hold gesture instead';
      this.setupMathQuestion();
    }
  }

  public toggleMode(): void {
    this.switchMode();
  }

  // --- Dual-Corner Hold Logic ---
  private bindCornerEvents(): void {
    if (!this.cornerLeftBtn || !this.cornerRightBtn) return;

    this.cornerLeftBtn.addEventListener('pointerdown', (e) => this.onCornerPointerDown('left', e));
    this.cornerLeftBtn.addEventListener('pointerup', (e) => this.onCornerPointerUp('left', e));
    this.cornerLeftBtn.addEventListener('pointercancel', (e) => this.onCornerPointerUp('left', e));

    this.cornerRightBtn.addEventListener('pointerdown', (e) => this.onCornerPointerDown('right', e));
    this.cornerRightBtn.addEventListener('pointerup', (e) => this.onCornerPointerUp('right', e));
    this.cornerRightBtn.addEventListener('pointercancel', (e) => this.onCornerPointerUp('right', e));
  }

  private onCornerPointerDown(corner: 'left' | 'right', e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (corner === 'left') {
      if (this.activePointerLeft !== null) return;
      this.activePointerLeft = e.pointerId;
      this.cornerLeftBtn?.classList.add('is-active');
    } else {
      if (this.activePointerRight !== null) return;
      this.activePointerRight = e.pointerId;
      this.cornerRightBtn?.classList.add('is-active');
    }

    if (typeof (e.target as any)?.setPointerCapture === 'function') {
      try {
        (e.target as any).setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    try {
      HapticController.getInstance().lightTap();
    } catch (_) {}
    try {
      AudioController.getInstance().play('synth:click', 440);
    } catch (_) {}

    // Check if both corners held by distinct pointers
    if (
      this.activePointerLeft !== null &&
      this.activePointerRight !== null &&
      this.activePointerLeft !== this.activePointerRight
    ) {
      this.startHold();
    }
  }

  private onCornerPointerUp(corner: 'left' | 'right', e: PointerEvent): void {
    if (corner === 'left' && this.activePointerLeft === e.pointerId) {
      this.activePointerLeft = null;
      this.cornerLeftBtn?.classList.remove('is-active');
      this.cancelHold();
    } else if (corner === 'right' && this.activePointerRight === e.pointerId) {
      this.activePointerRight = null;
      this.cornerRightBtn?.classList.remove('is-active');
      this.cancelHold();
    }
  }

  private handleWindowPointerRelease(e: PointerEvent): void {
    if (this.activePointerLeft === e.pointerId) {
      this.activePointerLeft = null;
      this.cornerLeftBtn?.classList.remove('is-active');
      this.cancelHold();
    }
    if (this.activePointerRight === e.pointerId) {
      this.activePointerRight = null;
      this.cornerRightBtn?.classList.remove('is-active');
      this.cancelHold();
    }
  }

  private startHold(): void {
    if (this.isHolding) return;
    this.isHolding = true;
    this.holdStartTime = performance.now();
    this.modalElement?.classList.add('is-holding');

    this.tickCountdown();

    this.holdTimerId = setTimeout(() => {
      this.completeHold();
    }, this.holdDurationMs);
  }

  public cancelHold(resetAllPointers = false): void {
    if (this.holdTimerId !== null) {
      clearTimeout(this.holdTimerId);
      this.holdTimerId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.isHolding = false;
    this.modalElement?.classList.remove('is-holding');
    if (this.countdownText) {
      this.countdownText.textContent = '3s';
    }

    if (resetAllPointers) {
      this.resetPointers();
    }
  }

  private tickCountdown(): void {
    if (!this.isHolding) return;
    const elapsed = performance.now() - this.holdStartTime;
    const remainingSeconds = Math.max(1, Math.ceil((this.holdDurationMs - elapsed) / 1000));
    if (this.countdownText) {
      this.countdownText.textContent = `${remainingSeconds}s`;
    }

    if (elapsed < this.holdDurationMs) {
      this.animFrameId = requestAnimationFrame(() => this.tickCountdown());
    }
  }

  private completeHold(): void {
    this.cancelHold();
    if (this.countdownText) {
      this.countdownText.textContent = '✓';
    }
    this.resolveSuccess();
  }

  // --- Cognitive Math Logic ---
  private setupMathQuestion(): void {
    if (!this.mathContainer || this.isLockedOut) return;

    this.isEvaluating = false;
    this.currentQuestion = this.generateMathQuestion();
    const promptEl = this.mathContainer.querySelector('#parental-gate-math-prompt');
    const gridEl = this.mathContainer.querySelector('.parental-gate-math-grid');

    if (promptEl) {
      promptEl.textContent = this.currentQuestion.prompt;
    }

    if (gridEl) {
      gridEl.innerHTML = '';
      this.currentQuestion.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'parental-gate-choice-btn';
        btn.type = 'button';
        btn.textContent = String(opt);
        btn.dataset.answer = String(opt);
        btn.setAttribute('aria-label', `Answer ${opt}`);
        btn.addEventListener('click', () => this.handleMathChoice(opt, btn));
        gridEl.appendChild(btn);
      });
    }
  }

  private generateMathQuestion(): MathQuestion {
    const ops = ['+', '-', '*'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = 0;
    let b = 0;
    let answer = 0;
    let prompt = '';

    if (op === '+') {
      a = Math.floor(Math.random() * 8) + 4; // 4 to 11
      b = Math.floor(Math.random() * 8) + 3; // 3 to 10
      answer = a + b;
      prompt = `What is ${a} + ${b}?`;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 9) + 12; // 12 to 20
      b = Math.floor(Math.random() * 8) + 3;  // 3 to 10
      answer = a - b;
      prompt = `What is ${a} - ${b}?`;
    } else {
      a = Math.floor(Math.random() * 4) + 2; // 2 to 5
      b = Math.floor(Math.random() * 6) + 3; // 3 to 8
      answer = a * b;
      prompt = `What is ${a} × ${b}?`;
    }

    const options = new Set<number>([answer]);
    const deltas = [-3, -2, -1, 1, 2, 3, 10, -10];
    while (options.size < 4) {
      const delta = deltas[Math.floor(Math.random() * deltas.length)];
      const candidate = answer + delta;
      if (candidate > 0 && candidate !== answer) {
        options.add(candidate);
      }
    }

    const shuffled = Array.from(options).sort(() => Math.random() - 0.5);
    return { prompt, correctAnswer: answer, options: shuffled };
  }

  private handleMathChoice(chosen: number, buttonEl: HTMLButtonElement): void {
    if (!this.currentQuestion || this.isLockedOut || this.isEvaluating) return;

    this.isEvaluating = true;

    // Immediately disable all choice buttons to prevent rapid tap / multi-touch race condition
    const choiceBtns = this.mathContainer?.querySelectorAll<HTMLButtonElement>('.parental-gate-choice-btn');
    choiceBtns?.forEach((b) => (b.disabled = true));

    if (chosen === this.currentQuestion.correctAnswer) {
      buttonEl.classList.add('is-correct');
      this.resolveSuccess();
    } else {
      buttonEl.classList.add('is-incorrect');
      try {
        HapticController.getInstance().heavyImpact();
      } catch (_) {}
      try {
        AudioController.getInstance().play('synth:click', 150);
      } catch (_) {}

      this.modalElement?.classList.add('shake');
      if (this.shakeTimerId !== null) {
        clearTimeout(this.shakeTimerId);
      }
      this.shakeTimerId = setTimeout(() => {
        this.modalElement?.classList.remove('shake');
        this.shakeTimerId = null;
      }, 250);

      this.failedAttempts++;
      if (this.failedAttempts >= 3) {
        this.triggerLockout();
      } else {
        // Anti-guessing re-roll after 250ms shake period
        if (this.mathRerollTimerId !== null) {
          clearTimeout(this.mathRerollTimerId);
        }
        this.mathRerollTimerId = setTimeout(() => {
          this.mathRerollTimerId = null;
          this.setupMathQuestion();
        }, 250);
      }
    }
  }

  private triggerLockout(): void {
    this.isLockedOut = true;
    this.isEvaluating = false;
    const gridEl = this.mathContainer?.querySelector('.parental-gate-math-grid');
    const msgEl = this.mathContainer?.querySelector('.parental-gate-lockout-msg');
    gridEl?.classList.add('hidden');
    msgEl?.classList.remove('hidden');

    this.lockoutTimerId = setTimeout(() => {
      this.isLockedOut = false;
      this.failedAttempts = 0;
      gridEl?.classList.remove('hidden');
      msgEl?.classList.add('hidden');
      this.setupMathQuestion();
    }, 3000);
  }

  // --- Keyboard & Focus Trap ---
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
      return;
    }

    if (e.key === 'Tab' && this.modalElement) {
      const focusables = Array.from(
        this.modalElement.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not(.hidden), [tabindex="0"]'
        )
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  private unmount(): void {
    this.resetPointers();
    this.cancelHold();
    this.isEvaluating = false;

    if (this.lockoutTimerId !== null) {
      clearTimeout(this.lockoutTimerId);
      this.lockoutTimerId = null;
    }
    if (this.shakeTimerId !== null) {
      clearTimeout(this.shakeTimerId);
      this.shakeTimerId = null;
    }
    if (this.mathRerollTimerId !== null) {
      clearTimeout(this.mathRerollTimerId);
      this.mathRerollTimerId = null;
    }

    window.removeEventListener('pointerup', this.boundWindowPointerUp);
    window.removeEventListener('pointercancel', this.boundWindowPointerCancel);
    window.removeEventListener('touchcancel', this.boundWindowTouchCancel);
    window.removeEventListener('keydown', this.boundKeyDown);

    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.modalElement = null;
    }

    this.isOpen = false;
    this.onSuccessCallback = null;
    this.onCancelCallback = null;

    // Restore focus
    this.previousActiveElement?.focus?.();
    this.previousActiveElement = null;
  }

  public destroy(): void {
    this.unmount();
  }
}
