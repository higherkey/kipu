import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export class HapticController {
  private static instance: HapticController;

  private constructor() {}

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
   * Triggers a generic haptic vibration.
   */
  public vibrate(duration = 200) {
    if (!this.isEnabled()) return;
    Haptics.vibrate({ duration }).catch(err => {
      console.warn('Haptics vibrate failed', err);
    });
  }

  // Pre-defined haptic patterns
  public lightTap() {
    if (!this.isEnabled()) return;
    Haptics.impact({ style: ImpactStyle.Light }).catch(err => {
      console.warn('Haptics lightTap failed', err);
    });
  }

  public heavyImpact() {
    if (!this.isEnabled()) return;
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(err => {
      console.warn('Haptics heavyImpact failed', err);
    });
  }

  public success() {
    if (!this.isEnabled()) return;
    Haptics.notification({ type: NotificationType.Success }).catch(err => {
      console.warn('Haptics success notification failed', err);
    });
  }
}

