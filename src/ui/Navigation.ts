export class Navigation {
  private navShell: HTMLElement;
  private gameCanvas: HTMLCanvasElement;

  constructor() {
    this.navShell = document.getElementById('navigation-shell')!;
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  }

  public showMenu() {
    this.navShell.classList.remove('hidden');
    this.gameCanvas.classList.add('hidden');
  }

  public hideMenu() {
    this.navShell.classList.add('hidden');
    this.gameCanvas.classList.remove('hidden');
  }
}
