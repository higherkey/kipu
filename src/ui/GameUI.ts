import { Icons } from './Icons';
import { GameHeader } from './GameHeader';
import { GameFeedbackDialog } from './GameFeedbackDialog';
import './GameUI.css';

export interface GameUIConfig {
  gameId?: string;
  gameName: string;
  portalId?: string;
  portalName?: string;
  onPortalBack?: () => void;
  onHome: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onSoundToggle: (enabled: boolean) => void;
  onVibrationToggle: (enabled: boolean) => void;
  onMenuToggle?: () => void;
  onSettingsNav?: () => void;
}

/**
 * GameUI - A unified component system for all games.
 * Combines GameHeader (HUD) with a slide-out settings menu.
 */
export class GameUI {
  private readonly config: GameUIConfig;
  private readonly gameHeader: GameHeader;
  private readonly element: HTMLElement;
  private isOpen = false;
  private isPaused = false;
  private feedback: GameFeedbackDialog | null = null;

  constructor(config: GameUIConfig) {
    this.config = config;
    this.gameHeader = new GameHeader({
      gameName: config.gameName,
      portalId: config.portalId,
      portalName: config.portalName,
      onPortalBack: config.onPortalBack,
      onHome: config.onHome,
      onFeedback: config.gameId ? () => this.openFeedback() : undefined,
      onMenuToggle: () => {
        if (this.config.onMenuToggle) {
          this.config.onMenuToggle();
        } else {
          this.toggleMenu();
        }
      },
    });
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const menuEl = document.createElement('div');
    menuEl.id = 'slide-menu';
    menuEl.className = 'slide-menu';

    menuEl.innerHTML = `
      <div class="slide-menu-backdrop"></div>
      <div class="slide-menu-panel">
        <div class="slide-menu-header">
          <h3>Settings</h3>
          <button class="slide-menu-close-btn" title="Close" aria-label="Close Menu">
            <span class="menu-icon">${Icons.close}</span>
          </button>
        </div>
        <div class="slide-menu-content">
          <div class="slide-menu-actions">
            <button class="slide-menu-action-btn pause-btn" title="Pause Game" aria-label="Pause Game">
              <span class="action-icon">${Icons.pause}</span>
              <span class="action-label">Pause</span>
            </button>
            <button class="slide-menu-action-btn resume-btn hidden" title="Resume Game" aria-label="Resume Game">
              <span class="action-icon">${Icons.play}</span>
              <span class="action-label">Resume</span>
            </button>
            <button class="slide-menu-action-btn restart-btn" title="Restart Game" aria-label="Restart Game">
              <span class="action-icon">${Icons.refresh}</span>
              <span class="action-label">Restart</span>
            </button>
            <button class="slide-menu-action-btn exit-hub-btn" title="Exit to Hub" aria-label="Exit to Hub">
              <span class="action-icon">${Icons.home}</span>
              <span class="action-label">Exit to Hub</span>
            </button>
            <button class="slide-menu-action-btn parent-settings-btn" title="Parent Settings & Support" aria-label="Parent Settings & Support">
              <span class="action-icon">${Icons.settings}</span>
              <span class="action-label">Parent Settings</span>
            </button>
          </div>

          <div class="slide-menu-divider"></div>

          <div class="slide-menu-settings">
            <h4>Settings</h4>
            <div class="settings-grid">
              <div class="settings-item">
                <label class="settings-label">
                  <span class="settings-icon">${Icons.volumeOn}</span>
                  <span>Sound</span>
                </label>
                <button class="settings-toggle ${this.config.soundEnabled ? 'on' : ''}" title="Toggle Sound" aria-label="Toggle Sound" aria-pressed="${this.config.soundEnabled}">
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                </button>
              </div>
              <div class="settings-item">
                <label class="settings-label">
                  <span class="settings-icon">${Icons.vibrationOn}</span>
                  <span>Vibration</span>
                </label>
                <button class="settings-toggle ${this.config.vibrationEnabled ? 'on' : ''}" title="Toggle Vibration" aria-label="Toggle Vibration" aria-pressed="${this.config.vibrationEnabled}">
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    menuEl.querySelector('.slide-menu-close-btn')?.addEventListener('click', () => this.closeMenu());
    menuEl.querySelector('.slide-menu-backdrop')?.addEventListener('click', () => this.closeMenu());

    menuEl.querySelector('.pause-btn')?.addEventListener('click', () => this.pauseGame());
    menuEl.querySelector('.resume-btn')?.addEventListener('click', () => this.resumeGame());
    menuEl.querySelector('.restart-btn')?.addEventListener('click', () => {
      this.closeMenu();
      this.config.onRestart();
    });

    menuEl.querySelector('.exit-hub-btn')?.addEventListener('click', () => {
      this.closeMenu();
      this.config.onHome();
    });

    menuEl.querySelector('.parent-settings-btn')?.addEventListener('click', () => {
      this.closeMenu();
      if (this.config.onSettingsNav) {
        this.config.onSettingsNav();
      } else {
        this.config.onHome();
      }
    });

    // Sound toggle
    const soundToggle = menuEl.querySelector('.settings-grid .settings-item:nth-child(1) .settings-toggle');
    soundToggle?.addEventListener('click', () => {
      soundToggle.classList.toggle('on');
      const newState = soundToggle.classList.contains('on');
      soundToggle.setAttribute('aria-pressed', String(newState));
      this.config.onSoundToggle(newState);
    });

    // Vibration toggle
    const vibrationToggle = menuEl.querySelector('.settings-grid .settings-item:nth-child(2) .settings-toggle');
    vibrationToggle?.addEventListener('click', () => {
      vibrationToggle.classList.toggle('on');
      const newState = vibrationToggle.classList.contains('on');
      vibrationToggle.setAttribute('aria-pressed', String(newState));
      this.config.onVibrationToggle(newState);
    });

    // Prevent menu from closing when clicking inside it
    menuEl.querySelector('.slide-menu-panel')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    return menuEl;
  }

  public mount(): void {
    document.body.appendChild(this.element);
    this.gameHeader.mount();
  }

  public unmount(): void {
    this.closeFeedback();
    if (this.isOpen) {
      this.closeMenu();
    }
    this.element.remove();
    this.gameHeader.unmount();
  }

  public isMenuOpen(): boolean {
    return this.isOpen;
  }

  public isFeedbackOpen(): boolean {
    return this.feedback !== null;
  }

  private openFeedback(): void {
    if (!this.config.gameId || this.feedback) return;
    this.closeMenu();
    this.feedback = new GameFeedbackDialog({
      gameId: this.config.gameId,
      gameName: this.config.gameName,
      onClose: () => this.closeFeedback(true),
    });
    try {
      this.feedback.open();
    } catch {
      this.closeFeedback();
      window.alert('This browser could not open the feedback form.');
      return;
    }
    if (!this.isPaused) this.config.onPause();
  }

  public closeFeedback(resume = false): boolean {
    const feedback = this.feedback;
    if (!feedback) return false;
    this.feedback = null;
    feedback.destroy();
    if (resume && !this.isPaused) this.config.onResume();
    return true;
  }

  public toggleMenu(): void {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  public openMenu(): void {
    this.isOpen = true;
    this.element.classList.add('open');
    document.body.classList.add('menu-open');
  }

  public closeMenu(): void {
    this.isOpen = false;
    this.element.classList.remove('open');
    document.body.classList.remove('menu-open');
  }

  public pause(): void {
    this.isPaused = true;
    const pauseBtn = this.element.querySelector('.pause-btn');
    const resumeBtn = this.element.querySelector('.resume-btn');
    pauseBtn?.classList.add('hidden');
    resumeBtn?.classList.remove('hidden');
    this.config.onPause();
  }

  public resume(): void {
    this.isPaused = false;
    const pauseBtn = this.element.querySelector('.pause-btn');
    const resumeBtn = this.element.querySelector('.resume-btn');
    pauseBtn?.classList.remove('hidden');
    resumeBtn?.classList.add('hidden');
    this.config.onResume();
  }

  private pauseGame(): void {
    if (!this.isPaused) {
      this.pause();
    }
  }

  private resumeGame(): void {
    if (this.isPaused) {
      this.resume();
      this.closeMenu();
    }
  }

  public setGameName(name: string): void {
    this.config.gameName = name;
    this.gameHeader.setGameName(name);
  }

  public show(): void {
    this.gameHeader.show();
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.gameHeader.hide();
    this.element.classList.add('hidden');
  }
}
