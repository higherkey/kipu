import { Icons } from './Icons';

export class PauseMenu {
  private element: HTMLElement;
  private onResume: () => void;
  private onHome: () => void;

  constructor(onResume: () => void, onHome: () => void) {
    this.onResume = onResume;
    this.onHome = onHome;
    this.element = this.createMenu();
    document.body.appendChild(this.element);
  }

  private createMenu(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'pause-menu';
    overlay.className = 'overlay hidden';
    
    overlay.innerHTML = `
      <div class="menu-content">
        <h2>Paused</h2>
        <div class="menu-buttons">
          <button id="resume-btn" title="Resume">
            <span class="icon">${Icons.play}</span>
            <span>Resume</span>
          </button>
          <button id="home-btn" title="Home">
            <span class="icon">${Icons.home}</span>
            <span>Home</span>
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#resume-btn')?.addEventListener('click', () => this.onResume());
    overlay.querySelector('#home-btn')?.addEventListener('click', () => this.onHome());

    return overlay;
  }

  public show() {
    this.element.classList.remove('hidden');
  }

  public hide() {
    this.element.classList.add('hidden');
  }
}
