export class HapticController {
  private static instance: HapticController;

  private constructor() {}

  public static getInstance(): HapticController {
    if (!HapticController.instance) {
      HapticController.instance = new HapticController();
    }
    return HapticController.instance;
  }

  /**
   * Triggers a haptic feedback pattern.
   * @param pattern Array of durations (ms) or a single duration for vibration.
   */
  public vibrate(pattern: number | number[]) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // Pre-defined haptic patterns
  public lightTap() {
    this.vibrate(20);
  }

  public heavyImpact() {
    this.vibrate(50);
  }

  public success() {
    this.vibrate([30, 50, 30]);
  }
}
