import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export class HapticController {
  private static instance: HapticController;
  private switchElement: HTMLInputElement | null = null;
  private labelElement: HTMLLabelElement | null = null;
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked = false;

  private constructor() {
    this.initInteractionUnlock();
  }

  public static getInstance(): HapticController {
    if (!HapticController.instance) {
      HapticController.instance = new HapticController();
    }
    return HapticController.instance;
  }

  private isEnabled(): boolean {
    return localStorage.getItem('vibrationEnabled') !== 'false';
  }

  /**
   * Proactively unlock Web Audio Context on the initial user interaction.
   * Required for WebKit/iOS Safari synthetic haptic clicks.
   */
  public unlockAudioContext(): void {
    if (this.isAudioUnlocked || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx.state === 'suspended' && typeof this.audioCtx.resume === 'function') {
        this.audioCtx.resume().catch(() => {});
      }

      // WebKit silent buffer playback trick to unlock audio pipeline
      if (typeof this.audioCtx.createBufferSource === 'function' && typeof this.audioCtx.createBuffer === 'function') {
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      this.isAudioUnlocked = true;
    } catch {
      // Non-fatal if audio context initialization fails in test/headless environments
    }
  }

  private initInteractionUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlockAudioContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  /**
   * Lazily provisions the hidden switch input element compliant with Sitewright CSS rules.
   */
  private getSwitchElement(): HTMLInputElement | null {
    if (typeof document === 'undefined' || !document.body) return null;
    if (!this.switchElement || !document.body.contains(this.switchElement)) {
      if (this.labelElement && this.labelElement.parentNode) {
        this.labelElement.parentNode.removeChild(this.labelElement);
      }

      const el = document.createElement('input');
      el.type = 'checkbox';
      el.setAttribute('switch', '');
      el.id = 'haptic-switch-fallback';
      el.className = 'haptic-switch-fallback';
      el.tabIndex = -1;
      el.setAttribute('aria-hidden', 'true');
      
      const label = document.createElement('label');
      label.htmlFor = 'haptic-switch-fallback';
      label.className = 'haptic-label-fallback';
      label.setAttribute('aria-hidden', 'true');

      // Stop synthetic click from bubbling/capturing to document handlers,
      // but do NOT call e.preventDefault() so the switch toggles and triggers iOS Taptic feedback.
      if (typeof window !== 'undefined') {
        window.addEventListener(
          'click',
          (e) => {
            if (e.target === el || e.target === label) {
              e.stopImmediatePropagation();
            }
          },
          true
        );
      }

      document.body.appendChild(el);
      document.body.appendChild(label);
      this.switchElement = el;
      this.labelElement = label;
    }
    return this.switchElement;
  }

  /**
   * Triggers iOS 17.4+ WebKit switch haptic tick via programmatic click.
   */
  private triggerSwitchHaptic(): void {
    try {
      const el = this.getSwitchElement();
      if (this.labelElement) {
        this.labelElement.click();
      }
      if (el) {
        el.click();
      }
    } catch {
      // Silently ignore DOM issues in headless environments
    }
  }

  /**
   * Synthesizes low-frequency physical clicks for devices without native vibration motors.
   */
  private playSyntheticHaptic(type: 'light' | 'heavy' | 'success'): void {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (!soundEnabled || typeof window === 'undefined') return;

    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx.state === 'suspended' && typeof this.audioCtx.resume === 'function') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;

      if (type === 'light') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.02);
      } else if (type === 'heavy') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(70, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'success') {
        [0, 0.06].forEach((offset, idx) => {
          const osc = this.audioCtx!.createOscillator();
          const gain = this.audioCtx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 120 : 160, now + offset);
          gain.gain.setValueAtTime(0.15, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.025);
          osc.connect(gain);
          gain.connect(this.audioCtx!.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.025);
        });
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Triggers a generic haptic vibration with fallback hierarchy.
   */
  public vibrate(duration = 200): Promise<void> | void {
    if (!this.isEnabled()) return;

    if (Capacitor.isNativePlatform()) {
      return Haptics.vibrate({ duration }).catch(err => {
        console.warn('Native Haptics vibrate failed', err);
      });
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(duration);
      } catch (err) {
        console.warn('Navigator vibrate failed', err);
      }
      return Promise.resolve();
    }

    this.triggerSwitchHaptic();
    this.playSyntheticHaptic('light');
    return Promise.resolve();
  }

  /**
   * Light tactile tap pattern.
   */
  public lightTap(): Promise<void> | void {
    if (!this.isEnabled()) return;

    if (Capacitor.isNativePlatform()) {
      return Haptics.impact({ style: ImpactStyle.Light }).catch(err => {
        console.warn('Native Haptics lightTap failed', err);
      });
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(20);
      } catch (err) {
        console.warn('Navigator vibrate failed', err);
      }
      return Promise.resolve();
    }

    this.triggerSwitchHaptic();
    this.playSyntheticHaptic('light');
    return Promise.resolve();
  }

  /**
   * Heavy tactile impact pattern.
   */
  public heavyImpact(): Promise<void> | void {
    if (!this.isEnabled()) return;

    if (Capacitor.isNativePlatform()) {
      return Haptics.impact({ style: ImpactStyle.Heavy }).catch(err => {
        console.warn('Native Haptics heavyImpact failed', err);
      });
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(50);
      } catch (err) {
        console.warn('Navigator vibrate failed', err);
      }
      return Promise.resolve();
    }

    this.triggerSwitchHaptic();
    this.playSyntheticHaptic('heavy');
    return Promise.resolve();
  }

  /**
   * Success notification tactile pattern.
   */
  public success(): Promise<void> | void {
    if (!this.isEnabled()) return;

    if (Capacitor.isNativePlatform()) {
      return Haptics.notification({ type: NotificationType.Success }).catch(err => {
        console.warn('Native Haptics success failed', err);
      });
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([30, 50, 30]);
      } catch (err) {
        console.warn('Navigator vibrate failed', err);
      }
      return Promise.resolve();
    }

    this.triggerSwitchHaptic();
    this.playSyntheticHaptic('success');
    return Promise.resolve();
  }
}
