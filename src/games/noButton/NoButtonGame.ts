import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';
import { LANGUAGES, TranslationManager } from '../../core/TranslationManager';

export class NoButtonGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement | null = null;
  private langPicker: HTMLDivElement | null = null;
  private readonly audio: AudioController;
  private readonly haptics: HapticController;
  private windowClickListener: ((e: MouseEvent) => void) | null = null;

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    
    // Pre-register sounds
    this.audio.registerSound('no', '/sounds/no.ogg');
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.classList.add('hidden'); // We use DOM for this game

    // Create Game Container
    this.container = document.createElement('div');
    this.container.id = 'no-button-game';
    this.container.innerHTML = `
      <div class="no-button-wrapper">
        <button id="giant-no-button">NO</button>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.container);

    const button = this.container.querySelector('#giant-no-button') as HTMLButtonElement;
    button?.addEventListener('click', () => this.handlePress());

    // Create Language Picker
    this.langPicker = document.createElement('div');
    this.langPicker.className = 'language-picker-container';
    this.langPicker.innerHTML = `
      <button class="language-select-btn" id="lang-picker-toggle" aria-haspopup="listbox" aria-expanded="false">
        🌐 <span>${TranslationManager.getCurrent().name}</span>
      </button>
      <div class="language-dropdown" id="lang-picker-dropdown" role="listbox"></div>
    `;
    this.container.appendChild(this.langPicker);

    // Populate Languages Dropdown
    this.populateDropdown();
    this.updateButtonText();

    // Toggle Dropdown Event
    const toggleBtn = this.langPicker.querySelector('#lang-picker-toggle');
    const dropdown = this.langPicker.querySelector('#lang-picker-dropdown');
    
    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const show = !dropdown?.classList.contains('show');
      dropdown?.classList.toggle('show', show);
      toggleBtn.setAttribute('aria-expanded', String(show));
    });

    // Close on outside click
    this.windowClickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!this.langPicker?.contains(target)) {
        dropdown?.classList.remove('show');
        toggleBtn?.setAttribute('aria-expanded', 'false');
      }
    };
    window.addEventListener('click', this.windowClickListener);
  }

  private populateDropdown() {
    const dropdown = this.langPicker?.querySelector('#lang-picker-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = LANGUAGES.map(lang => {
      const isActive = lang.code === TranslationManager.getCurrent().code;
      return `
        <button class="language-option${isActive ? ' active' : ''}" data-code="${lang.code}" role="option" aria-selected="${isActive}">
          ${lang.name}
        </button>
      `;
    }).join('');

    // Option Click Events
    dropdown.querySelectorAll('.language-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = (e.currentTarget as HTMLElement).dataset.code;
        if (code) {
          TranslationManager.setLanguage(code);
          this.updateButtonText();
          this.updateDropdownActiveState();
          dropdown.classList.remove('show');
          this.langPicker?.querySelector('#lang-picker-toggle')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  private updateButtonText() {
    const button = this.container?.querySelector('#giant-no-button');
    if (button) {
      button.textContent = TranslationManager.getCurrent().no.toUpperCase();
    }
    const toggleBtnSpan = this.langPicker?.querySelector('#lang-picker-toggle span');
    if (toggleBtnSpan) {
      toggleBtnSpan.textContent = TranslationManager.getCurrent().name;
    }
  }

  private updateDropdownActiveState() {
    const options = this.langPicker?.querySelectorAll('.language-option');
    const currentCode = TranslationManager.getCurrent().code;
    options?.forEach(opt => {
      const code = (opt as HTMLElement).dataset.code;
      const isActive = code === currentCode;
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', String(isActive));
    });
  }

  private handlePress() {
    const currentLang = TranslationManager.getCurrent();
    
    // Play basic audio feedback
    this.audio.play('no');
    
    // Speak translated text via TTS
    this.audio.speak(currentLang.no, currentLang.code);

    // Haptics and visual animations
    this.haptics.heavyImpact();
    this.triggerShake();
    this.triggerSquashStretch();
  }

  private triggerShake() {
    if (this.container) {
      this.container.classList.add('shake');
      setTimeout(() => {
        this.container?.classList.remove('shake');
      }, 500);
    }
  }

  private triggerSquashStretch() {
    const button = this.container?.querySelector('#giant-no-button');
    if (button) {
      button.classList.remove('squash-stretch');
      // Trigger reflow to restart css animation
      button.getBoundingClientRect();
      button.classList.add('squash-stretch');
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
    if (this.windowClickListener) {
      window.removeEventListener('click', this.windowClickListener);
      this.windowClickListener = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    if (this.canvas) {
      this.canvas.classList.remove('hidden');
    }
  }
}
