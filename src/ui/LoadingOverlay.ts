export class LoadingOverlay {
  private readonly element: HTMLDivElement;
  private showTimeout: number | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'loading-overlay';
    this.element.innerHTML = `
      <div class="loader-content">
        <div class="bouncy-ball"></div>
        <p>Loading...</p>
      </div>
    `;
    document.body.appendChild(this.element);
  }

  public show(gracePeriodMs: number = 0): void {
    this.cancelTimeout();

    if (gracePeriodMs > 0) {
      this.showTimeout = window.setTimeout(() => {
        this.element.classList.add('fade-in');
        this.showTimeout = null;
      }, gracePeriodMs);
    } else {
      this.element.classList.add('fade-in');
    }
  }

  public hide(): void {
    this.cancelTimeout();
    this.element.classList.remove('fade-in');
  }

  private cancelTimeout(): void {
    if (this.showTimeout !== null) {
      window.clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }
}
