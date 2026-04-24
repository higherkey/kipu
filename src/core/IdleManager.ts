export class IdleManager {
  private timeoutId: number | null = null;
  private readonly timeoutMs: number;
  private onIdle: () => void;

  constructor(timeoutMs: number, onIdle: () => void) {
    this.timeoutMs = timeoutMs;
    this.onIdle = onIdle;
    this.initListeners();
    this.resetTimer();
  }

  private initListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'touchstart', 'scroll'];
    events.forEach(name => {
      document.addEventListener(name, () => this.resetTimer(), { passive: true });
    });
  }

  private resetTimer() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
    }
    this.timeoutId = window.setTimeout(() => {
      this.onIdle();
    }, this.timeoutMs);
  }

  public stop() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public start() {
    this.resetTimer();
  }
}
