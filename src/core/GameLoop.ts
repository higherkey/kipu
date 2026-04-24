export class GameLoop {
  private lastTime: number = 0;
  private animFrameId: number = 0;
  private isRunning: boolean = false;
  private tickCallback: (dt: number) => void;

  constructor(tickCallback: (dt: number) => void) {
    this.tickCallback = tickCallback;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const dt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap dt to prevent huge jumps (e.g. when switching tabs)
    const cappedDt = Math.min(dt, 100);

    this.tickCallback(cappedDt);

    this.animFrameId = requestAnimationFrame((time) => this.loop(time));
  }
}
