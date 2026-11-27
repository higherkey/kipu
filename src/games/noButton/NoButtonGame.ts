import { BaseGame } from '../../core/BaseGame';
import { LANGUAGES, TranslationManager } from '../../core/TranslationManager';
import './NoButtonGame.css';

export type EenoCategory = 'basic' | 'greetings' | 'colors' | 'numbers';

export class NoButtonGame extends BaseGame {
  private container: HTMLDivElement | null = null;
  private isDropdownOpen = false;
  private documentClickListener: ((e: MouseEvent) => void) | null = null;
  private voicesChangedListener: (() => void) | null = null;

  // Category & Voice settings state
  private activeCategory: EenoCategory = 'basic';
  private selectedGender: 'auto' | 'female' | 'male' = 'auto';
  private selectedPitch: number = 1.0;
  private selectedRate: number = 1.0;

  protected onInit(): void {
    this.canvas?.classList.add('hidden'); // We use DOM for this game

    this.container = document.createElement('div');
    this.container.id = 'no-button-game';
    this.container.innerHTML = `
      <div class="game-controls">
        <div class="custom-dropdown" id="language-dropdown-container">
          <button class="dropdown-trigger" id="dropdown-trigger-btn" aria-haspopup="listbox" aria-expanded="false">
            🌐 <span id="current-lang-name">Select Language</span>
          </button>
          <div class="dropdown-options" id="dropdown-options-list" role="listbox"></div>
        </div>
        <button id="random-lang-btn" class="control-btn">Random</button>
      </div>

      <!-- Category Navigation Tabs -->
      <nav class="eeno-category-bar" aria-label="Vocabulary Categories">
        <button class="eeno-tab-btn active" data-category="basic" id="tab-basic">Yes / No</button>
        <button class="eeno-tab-btn" data-category="greetings" id="tab-greetings">Greetings</button>
        <button class="eeno-tab-btn" data-category="colors" id="tab-colors">Colors</button>
        <button class="eeno-tab-btn" data-category="numbers" id="tab-numbers">Numbers</button>
      </nav>

      <!-- Voice Settings Bar -->
      <div class="eeno-voice-bar" aria-label="Voice Controls">
        <div class="voice-setting-group">
          <span class="voice-setting-label">Voice:</span>
          <button class="eeno-voice-btn active" data-gender="auto" id="voice-gender-auto" aria-label="Auto voice">✨ Auto</button>
          <button class="eeno-voice-btn" data-gender="female" id="voice-gender-female" aria-label="Female voice">👧 Female</button>
          <button class="eeno-voice-btn" data-gender="male" id="voice-gender-male" aria-label="Male voice">👦 Male</button>
        </div>
        <div class="voice-setting-group">
          <span class="voice-setting-label">Pitch:</span>
          <button class="eeno-voice-btn" data-pitch="0.85" id="pitch-low" aria-label="Low pitch">Low</button>
          <button class="eeno-voice-btn active" data-pitch="1.0" id="pitch-normal" aria-label="Normal pitch">Mid</button>
          <button class="eeno-voice-btn" data-pitch="1.25" id="pitch-high" aria-label="High pitch">High</button>
        </div>
        <div class="voice-setting-group">
          <span class="voice-setting-label">Speed:</span>
          <button class="eeno-voice-btn" data-rate="0.8" id="speed-slow" aria-label="Slow speed">🐢</button>
          <button class="eeno-voice-btn active" data-rate="1.0" id="speed-normal" aria-label="Normal speed">🚶</button>
          <button class="eeno-voice-btn" data-rate="1.3" id="speed-fast" aria-label="Fast speed">🐰</button>
        </div>
      </div>

      <!-- View 1: Basic Yes / No -->
      <div class="eeno-view" id="view-basic">
        <div class="buttons-container">
          <div class="giant-button-wrapper" id="no-wrapper">
            <button id="giant-no-button" class="giant-button">NO</button>
          </div>
          <div class="giant-button-wrapper" id="yes-wrapper">
            <button id="giant-yes-button" class="giant-button">YES</button>
          </div>
        </div>
      </div>

      <!-- View 2: Greetings Grid -->
      <div class="eeno-view hidden" id="view-greetings">
        <div class="eeno-grid-greetings" id="greetings-container"></div>
      </div>

      <!-- View 3: Colors Grid -->
      <div class="eeno-view hidden" id="view-colors">
        <div class="eeno-grid-colors" id="colors-container"></div>
      </div>

      <!-- View 4: Numbers Grid -->
      <div class="eeno-view hidden" id="view-numbers">
        <div class="eeno-grid-numbers" id="numbers-container"></div>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.container);

    this.bindEvents();
    this.renderLanguageList();
    this.renderCategoryViews();
    this.updateUI();

    // Listen for Web Speech API voices loading asynchronously
    if ('speechSynthesis' in window && window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
      this.voicesChangedListener = () => {
        this.renderLanguageList();
        this.updateUI();
      };
      window.speechSynthesis.addEventListener('voiceschanged', this.voicesChangedListener);
    }
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Basic buttons
    const noBtn = this.container.querySelector('#giant-no-button');
    const yesBtn = this.container.querySelector('#giant-yes-button');
    noBtn?.addEventListener('click', () => this.handleNo());
    yesBtn?.addEventListener('click', () => this.handleYes());

    // Language dropdown
    const triggerBtn = this.container.querySelector('#dropdown-trigger-btn');
    triggerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    const randomBtn = this.container.querySelector('#random-lang-btn');
    randomBtn?.addEventListener('click', () => {
      const supportedLanguages = LANGUAGES.filter(l => this.audio.isLanguageSupported(l.code));
      const candidates = supportedLanguages.length > 0 ? supportedLanguages : [LANGUAGES[0]];
      const random = candidates[Math.floor(Math.random() * candidates.length)];
      
      TranslationManager.setLanguage(random.code);
      this.updateUI();
      this.speakWord(random.yes + '!');
    });

    // Category Tabs
    this.container.querySelectorAll('.eeno-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).dataset.category as EenoCategory;
        if (cat) this.setCategory(cat);
      });
    });

    // Voice Gender Buttons
    this.container.querySelectorAll('[data-gender]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const gender = target.dataset.gender as 'auto' | 'female' | 'male';
        if (gender) {
          this.selectedGender = gender;
          this.container?.querySelectorAll('[data-gender]').forEach(b => b.classList.remove('active'));
          target.classList.add('active');
          this.haptics.lightTap();
        }
      });
    });

    // Voice Pitch Buttons
    this.container.querySelectorAll('[data-pitch]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const pitch = Number.parseFloat(target.dataset.pitch || '1.0');
        this.selectedPitch = pitch;
        this.container?.querySelectorAll('[data-pitch]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.haptics.lightTap();
      });
    });

    // Voice Rate Buttons
    this.container.querySelectorAll('[data-rate]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const rate = Number.parseFloat(target.dataset.rate || '1.0');
        this.selectedRate = rate;
        this.container?.querySelectorAll('[data-rate]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.haptics.lightTap();
      });
    });

    // Close dropdown on outside click
    this.documentClickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (this.isDropdownOpen && !this.container?.querySelector('#language-dropdown-container')?.contains(target)) {
        this.toggleDropdown(false);
      }
    };
    document.addEventListener('click', this.documentClickListener);
  }

  public setCategory(category: EenoCategory): void {
    this.activeCategory = category;
    this.haptics.lightTap();

    if (!this.container) return;

    // Update active tab button
    this.container.querySelectorAll('.eeno-tab-btn').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.category === category);
    });

    // Toggle view containers
    const views = ['basic', 'greetings', 'colors', 'numbers'];
    views.forEach(v => {
      const el = this.container?.querySelector(`#view-${v}`);
      el?.classList.toggle('hidden', v !== category);
    });

    this.renderCategoryViews();
  }

  public getCategory(): EenoCategory {
    return this.activeCategory;
  }

  public getSelectedGender(): 'auto' | 'female' | 'male' {
    return this.selectedGender;
  }

  public getSelectedPitch(): number {
    return this.selectedPitch;
  }

  public getSelectedRate(): number {
    return this.selectedRate;
  }

  private toggleDropdown(show?: boolean): void {
    const dropdown = this.container?.querySelector('#dropdown-options-list');
    const trigger = this.container?.querySelector('#dropdown-trigger-btn');
    if (!dropdown || !trigger) return;

    this.isDropdownOpen = show ?? !this.isDropdownOpen;
    dropdown.classList.toggle('show', this.isDropdownOpen);
    trigger.setAttribute('aria-expanded', String(this.isDropdownOpen));
  }

  private renderLanguageList(): void {
    const list = this.container?.querySelector('#dropdown-options-list');
    if (!list) return;

    list.innerHTML = LANGUAGES.map(l => {
      const isSupported = this.audio.isLanguageSupported(l.code);
      const isSelected = l.code === TranslationManager.getCurrent().code;

      if (!isSupported) {
        const userAgent = navigator.userAgent;
        const isWindows = userAgent.includes('Windows');
        const isMac = userAgent.includes('Mac');
        const isAndroid = userAgent.includes('Android');
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);

        let instructions = 'Install this voice package in your device settings.';
        if (isWindows) {
          instructions = 'Settings -> Time & Language -> Speech -> Add voices.';
        } else if (isMac || isIOS) {
          instructions = 'Settings -> Accessibility -> Spoken Content -> Voices.';
        } else if (isAndroid) {
          instructions = 'Settings -> Languages & Input -> Text-to-speech output.';
        }

        return `
          <div class="dropdown-option-wrapper">
            <button class="dropdown-option disabled" disabled data-code="${l.code}">
              <span>${l.name}</span>
              <span class="badge">Not Installed</span>
            </button>
            <span class="tooltip">${instructions}</span>
          </div>
        `;
      }

      return `
        <div class="dropdown-option-wrapper">
          <button class="dropdown-option${isSelected ? ' active' : ''}" data-code="${l.code}">
            <span>${l.name}</span>
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.dropdown-option:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = (e.currentTarget as HTMLElement).dataset.code;
        if (code) {
          TranslationManager.setLanguage(code);
          this.updateUI();
          this.renderCategoryViews();
          this.toggleDropdown(false);
        }
      });
    });
  }

  private renderCategoryViews(): void {
    if (!this.container) return;
    const lang = TranslationManager.getCurrent();
    const vocab = TranslationManager.getVocabForLanguage(lang.code);

    // Greetings Grid
    const greetingsContainer = this.container.querySelector('#greetings-container');
    if (greetingsContainer) {
      greetingsContainer.innerHTML = `
        <button class="eeno-word-card" data-word="${vocab.hello}" aria-label="Hello">
          <span class="eeno-card-icon">👋</span>
          <span class="eeno-card-text">${vocab.hello}</span>
        </button>
        <button class="eeno-word-card" data-word="${vocab.bye}" aria-label="Bye">
          <span class="eeno-card-icon">🎈</span>
          <span class="eeno-card-text">${vocab.bye}</span>
        </button>
        <button class="eeno-word-card" data-word="${vocab.please}" aria-label="Please">
          <span class="eeno-card-icon">🙏</span>
          <span class="eeno-card-text">${vocab.please}</span>
        </button>
        <button class="eeno-word-card" data-word="${vocab.thankYou}" aria-label="Thank you">
          <span class="eeno-card-icon">⭐</span>
          <span class="eeno-card-text">${vocab.thankYou}</span>
        </button>
      `;

      greetingsContainer.querySelectorAll('.eeno-word-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const word = (e.currentTarget as HTMLElement).dataset.word;
          if (word) this.speakWord(word);
        });
      });
    }

    // Colors Grid
    const colorsContainer = this.container.querySelector('#colors-container');
    if (colorsContainer) {
      colorsContainer.innerHTML = `
        <button class="eeno-color-card card-red" data-word="${vocab.colors.red}" aria-label="Red">
          <span class="eeno-card-icon">🔴</span>
          <span class="eeno-card-text">${vocab.colors.red}</span>
        </button>
        <button class="eeno-color-card card-blue" data-word="${vocab.colors.blue}" aria-label="Blue">
          <span class="eeno-card-icon">🔵</span>
          <span class="eeno-card-text">${vocab.colors.blue}</span>
        </button>
        <button class="eeno-color-card card-yellow" data-word="${vocab.colors.yellow}" aria-label="Yellow">
          <span class="eeno-card-icon">🟡</span>
          <span class="eeno-card-text">${vocab.colors.yellow}</span>
        </button>
        <button class="eeno-color-card card-green" data-word="${vocab.colors.green}" aria-label="Green">
          <span class="eeno-card-icon">🟢</span>
          <span class="eeno-card-text">${vocab.colors.green}</span>
        </button>
      `;

      colorsContainer.querySelectorAll('.eeno-color-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const word = (e.currentTarget as HTMLElement).dataset.word;
          if (word) this.speakWord(word);
        });
      });
    }

    // Numbers Grid
    const numbersContainer = this.container.querySelector('#numbers-container');
    if (numbersContainer) {
      numbersContainer.innerHTML = vocab.numbers.map((word, idx) => `
        <button class="eeno-number-btn" data-word="${word}" aria-label="Number ${idx + 1}">
          <span class="eeno-num-digit">${idx + 1}</span>
          <span class="eeno-num-word">${word}</span>
        </button>
      `).join('');

      numbersContainer.querySelectorAll('.eeno-number-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const word = (e.currentTarget as HTMLElement).dataset.word;
          if (word) this.speakWord(word);
        });
      });
    }
  }

  private updateUI(): void {
    const lang = TranslationManager.getCurrent();
    
    // Update Yes/No buttons text
    const yesBtn = this.container?.querySelector('#giant-yes-button');
    const noBtn = this.container?.querySelector('#giant-no-button');
    if (yesBtn) yesBtn.textContent = lang.yes.toUpperCase();
    if (noBtn) noBtn.textContent = lang.no.toUpperCase();

    // Update current selected language trigger button text
    const triggerSpan = this.container?.querySelector('#current-lang-name');
    if (triggerSpan) {
      triggerSpan.textContent = lang.name;
    }

    // Refresh option list active classes
    const list = this.container?.querySelector('#dropdown-options-list');
    if (list) {
      list.querySelectorAll('.dropdown-option:not(.disabled)').forEach(opt => {
        const code = (opt as HTMLElement).dataset.code;
        opt.classList.toggle('active', code === lang.code);
      });
    }
  }

  public speakWord(text: string): void {
    const lang = TranslationManager.getCurrent();
    this.haptics.lightTap();

    let spoken = false;
    if ('speechSynthesis' in window && window.speechSynthesis && typeof window.speechSynthesis.speak === 'function') {
      try {
        this.audio.speak(text, lang.code, {
          gender: this.selectedGender,
          pitch: this.selectedPitch,
          rate: this.selectedRate,
        });
        spoken = true;
      } catch {
        spoken = false;
      }
    }
    if (!spoken) {
      // Graceful fallback audio cue
      this.audio.play('synth:bell', 440);
    }
  }

  private handleNo(): void {
    const lang = TranslationManager.getCurrent();
    this.speakWord(lang.no + '.');
    this.triggerAnimation('no-wrapper', 'shake');
  }

  private handleYes(): void {
    const lang = TranslationManager.getCurrent();
    this.speakWord(lang.yes + '!');
    this.triggerAnimation('yes-wrapper', 'squash-stretch');
  }

  private triggerAnimation(wrapperId: string, className: string): void {
    const wrapper = this.container?.querySelector(`#${wrapperId}`);
    if (wrapper) {
      wrapper.classList.remove(className);
      const _reflow = (wrapper as HTMLElement).offsetWidth;
      wrapper.classList.add(className);
    }
  }

  public update(_dt: number): void {
    // No frame-by-frame canvas updates needed for this DOM game
  }

  public pause(): void {
    if (this.container) {
      this.container.classList.add('game-paused');
    }
  }

  public resume(): void {
    if (this.container) {
      this.container.classList.remove('game-paused');
    }
  }

  public destroy(): void {
    if ('speechSynthesis' in window && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }
    if (this.documentClickListener) {
      document.removeEventListener('click', this.documentClickListener);
      this.documentClickListener = null;
    }
    if (this.voicesChangedListener && 'speechSynthesis' in window && window.speechSynthesis && typeof window.speechSynthesis.removeEventListener === 'function') {
      window.speechSynthesis.removeEventListener('voiceschanged', this.voicesChangedListener);
      this.voicesChangedListener = null;
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
