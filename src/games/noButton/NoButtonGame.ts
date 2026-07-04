import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { LANGUAGES, TranslationManager } from '../../core/TranslationManager';

export class NoButtonGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement | null = null;
  private audio: AudioController;

  constructor() {
    this.audio = AudioController.getInstance();
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.classList.add('hidden'); // We use DOM for this game

    this.container = document.createElement('div');
    this.container.id = 'no-button-game';
    this.container.innerHTML = `
      <div class="game-controls">
        <select id="language-select" class="voice-dropdown" aria-label="Select Language">
          ${LANGUAGES.map(l => `<option value="${l.code}">${l.name}${l.englishName ? ` (${l.englishName})` : ''}</option>`).join('')}
        </select>
        <button id="random-lang-btn" class="control-btn">Random</button>
      </div>
      <div class="buttons-container">
        <div class="giant-button-wrapper" id="no-wrapper">
          <button id="giant-no-button" class="giant-button">NO</button>
        </div>
        <div class="giant-button-wrapper" id="yes-wrapper">
          <button id="giant-yes-button" class="giant-button">YES</button>
        </div>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.container);

    const noBtn = this.container.querySelector('#giant-no-button');
    const yesBtn = this.container.querySelector('#giant-yes-button');
    const langSelect = this.container.querySelector('#language-select') as HTMLSelectElement;
    const randomBtn = this.container.querySelector('#random-lang-btn');

    noBtn?.addEventListener('click', () => this.handleNo());
    yesBtn?.addEventListener('click', () => this.handleYes());

    langSelect?.addEventListener('change', () => {
      TranslationManager.setLanguage(langSelect.value);
      this.updateUI();
    });

    randomBtn?.addEventListener('click', () => {
      const random = TranslationManager.getRandom();
      langSelect.value = random.code;
      TranslationManager.setLanguage(random.code);
      this.updateUI();
      this.audio.speak(random.yes + '!', random.code);
    });

    // Initial sync with browser locale or TranslationManager default
    const currentLang = TranslationManager.getCurrent();
    if (currentLang) {
      langSelect.value = currentLang.code;
    } else {
      const browserLang = TranslationManager.getByCode(window.navigator.language);
      if (browserLang) {
        langSelect.value = browserLang.code;
        TranslationManager.setLanguage(browserLang.code);
      }
    }
    this.updateUI();
  }

  private updateUI() {
    const lang = TranslationManager.getCurrent();
    const yesBtn = this.container?.querySelector('#giant-yes-button');
    const noBtn = this.container?.querySelector('#giant-no-button');
    if (yesBtn) yesBtn.textContent = lang.yes.toUpperCase();
    if (noBtn) noBtn.textContent = lang.no.toUpperCase();
  }

  private handleNo() {
    const lang = TranslationManager.getCurrent();
    this.audio.speak(lang.no + '.', lang.code);
    this.triggerAnimation('no-wrapper', 'shake');
  }

  private handleYes() {
    const lang = TranslationManager.getCurrent();
    this.audio.speak(lang.yes + '!', lang.code);
    this.triggerAnimation('yes-wrapper', 'squash-stretch');
  }

  private triggerAnimation(wrapperId: string, className: string) {
    const wrapper = this.container?.querySelector(`#${wrapperId}`);
    if (wrapper) {
      wrapper.classList.remove(className);
      // Trigger reflow to restart CSS animation
      void (wrapper as HTMLElement).offsetWidth;
      wrapper.classList.add(className);
    }
  }

  update(_dt: number): void {
    // No frame-by-frame updates needed for this DOM game
  }

  pause(): void {
    if (this.container) this.container.style.pointerEvents = 'none';
  }

  resume(): void {
    if (this.container) this.container.style.pointerEvents = 'all';
  }

  destroy(): void {
    window.speechSynthesis?.cancel();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.canvas) {
      this.canvas.classList.remove('hidden');
    }
  }
}
