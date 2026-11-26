import { Icons } from './Icons';
import { HapticController } from '../core/HapticController';
import { GameFeedbackInbox } from './GameFeedbackInbox';
import './SettingsView.css';

export interface DonationTier {
  id: string;
  name: string;
  price: string;
  priceCents: number;
  badge?: string;
  description: string;
  perks: string[];
}

export const DONATION_TIERS: DonationTier[] = [
  {
    id: 'supporter_coffee',
    name: 'Supporter Coffee',
    price: '$2.00',
    priceCents: 200,
    badge: 'Tip Jar',
    description: 'Buy the developer a warm cup of coffee. Keeps the Andean loom running!',
    perks: [
      'Keep Kipu 100% ad-free & tracker-free',
      'Supporter badge displayed in Settings',
      'Warm gratitude from the dev team'
    ]
  },
  {
    id: 'toy_box_pack',
    name: 'Toy Box Pack',
    price: '$5.00',
    priceCents: 500,
    badge: 'Most Popular',
    description: 'Unlock future bonus sensory toy prototypes, custom palettes, and sound packs.',
    perks: [
      'All Supporter Coffee perks',
      'Early access to Phase 4 sensory prototypes',
      'Custom tactile switchboard themes & sound packs'
    ]
  },
  {
    id: 'lifetime_explorer',
    name: 'Lifetime Explorer',
    price: '$10.00',
    priceCents: 1000,
    badge: 'Best Value',
    description: 'All-access pass to every current game, upcoming portals, and lifetime updates.',
    perks: [
      'All Toy Box Pack perks',
      'Permanent all-access lifetime pass',
      'All future portals & game releases included',
      'Special mention in developer credits'
    ]
  }
];

export interface SettingsViewConfig {
  onBack: () => void;
  onSoundToggle?: (enabled: boolean) => void;
  onVibrationToggle?: (enabled: boolean) => void;
  onHighContrastToggle?: (enabled: boolean) => void;
  onParentalGateModeChange?: (mode: 'auto' | 'dual_hold' | 'math') => void;
  onParentalGateToggle?: (enabled: boolean) => void;
  onTierPurchased?: (tierId: string) => void;
  skipProcessingDelay?: boolean;
}

export class SettingsView {
  private readonly config: SettingsViewConfig;
  private readonly element: HTMLElement;
  private activeModal: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private readonly feedbackInbox = new GameFeedbackInbox();

  constructor(config: SettingsViewConfig) {
    this.config = config;
    this.element = this.createElement();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public mount(container: HTMLElement = document.body): void {
    const existing = document.getElementById('settings-view');
    if (existing) existing.remove();
    container.appendChild(this.element);
    this.attachEventListeners();
    this.syncUIWithState();
    void this.feedbackInbox.mount(this.element.querySelector('.feedback-inbox')!);
  }

  public unmount(): void {
    this.feedbackInbox.unmount();
    this.closePurchaseModal();
    this.element.remove();
  }

  private createElement(): HTMLElement {
    const el = document.createElement('main');
    el.id = 'settings-view';
    el.className = 'settings-view';
    el.setAttribute('role', 'main');
    el.setAttribute('aria-label', 'Settings and Support');

    el.innerHTML = `
      <header class="settings-header">
        <div class="settings-nav-bar">
          <div class="settings-nav-left">
            <button class="settings-back-btn back-btn" aria-label="Back to Game Hub" title="Back to Game Hub">
              <span class="btn-icon">${Icons.back}</span>
              <span class="btn-label">Hub</span>
            </button>
          </div>
          <div class="settings-nav-center">
            <h1 class="settings-title">Settings & Support</h1>
          </div>
          <div class="settings-nav-right"></div>
        </div>
        <p class="settings-tagline">Preferences, Accessibility, and Support for Kipu</p>
      </header>

      <div class="settings-container">
        <!-- Section 1: Audio & Haptics -->
        <section class="settings-card" aria-labelledby="heading-sensory">
          <h2 id="heading-sensory" class="card-title">Sensory & Feedback</h2>
          <div class="settings-items-list">
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-icon">${Icons.volumeOn}</span>
                <div class="settings-row-text">
                  <span class="settings-row-title">Sound Effects & Music</span>
                  <span class="settings-row-desc">Audio playback, musical notes, and sound effects</span>
                </div>
              </div>
              <button class="settings-toggle sound-toggle" role="switch" aria-label="Toggle Sound" aria-checked="true" aria-pressed="true">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-icon">${Icons.vibrationOn}</span>
                <div class="settings-row-text">
                  <span class="settings-row-title">Haptic Vibration</span>
                  <span class="settings-row-desc">Tactile clicks on buttons and physical feedback</span>
                </div>
              </div>
              <button class="settings-toggle vibration-toggle" role="switch" aria-label="Toggle Vibration" aria-checked="true" aria-pressed="true">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <!-- Section 2: Accessibility -->
        <section class="settings-card" aria-labelledby="heading-accessibility">
          <h2 id="heading-accessibility" class="card-title">Accessibility</h2>
          <div class="settings-items-list">
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20Z"/></svg>
                </span>
                <div class="settings-row-text">
                  <span class="settings-row-title">High Contrast Mode</span>
                  <span class="settings-row-desc">Enhanced contrast outlines, stark colors, and WCAG AAA readability</span>
                </div>
              </div>
              <button class="settings-toggle high-contrast-toggle" role="switch" aria-label="Toggle High Contrast Mode" aria-checked="false" aria-pressed="false">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <!-- Section 3: Parental Controls -->
        <section class="settings-card" aria-labelledby="heading-parental">
          <h2 id="heading-parental" class="card-title">Parental Gate Controls</h2>
          <p class="card-desc">Protects settings, navigation exits, and external links from accidental toddler taps.</p>
          
          <div class="settings-items-list">
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <div class="settings-row-text">
                  <span class="settings-row-title">Parental Gate Active</span>
                  <span class="settings-row-desc">Require verification before exiting games or opening settings</span>
                </div>
              </div>
              <button class="settings-toggle parental-gate-toggle" role="switch" aria-label="Toggle Parental Gate" aria-checked="true" aria-pressed="true">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>

            <fieldset class="parental-mode-fieldset">
              <legend class="parental-mode-legend">Verification Method</legend>
              <div class="parental-mode-options" role="radiogroup" aria-label="Parental Gate Mode">
                <label class="parental-mode-option">
                  <input type="radio" name="parental-gate-mode" value="auto" class="mode-radio-input" checked />
                  <span class="mode-option-content">
                    <span class="mode-option-title">Smart Auto (Recommended)</span>
                    <span class="mode-option-desc">Dual-hold 3s on multi-touch mobile; arithmetic puzzle on desktop</span>
                  </span>
                </label>
                <label class="parental-mode-option">
                  <input type="radio" name="parental-gate-mode" value="dual_hold" class="mode-radio-input" />
                  <span class="mode-option-content">
                    <span class="mode-option-title">Dual-Corner 3s Hold</span>
                    <span class="mode-option-desc">Hold opposite screen corners simultaneously for 3 seconds</span>
                  </span>
                </label>
                <label class="parental-mode-option">
                  <input type="radio" name="parental-gate-mode" value="math" class="mode-radio-input" />
                  <span class="mode-option-content">
                    <span class="mode-option-title">Arithmetic Challenge</span>
                    <span class="mode-option-desc">Solve a randomized simple addition or subtraction problem</span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>
        </section>

        <section class="settings-card feedback-inbox" aria-labelledby="heading-feedback-inbox">
          <h2 id="heading-feedback-inbox" class="card-title">Game feedback</h2>
          <p class="card-desc">Notes and recordings saved on this device.</p>
          <p class="feedback-inbox-status" role="status" tabindex="-1">Loading feedback…</p>
          <ol class="feedback-inbox-list" aria-label="Game feedback"></ol>
        </section>

        <!-- Section 4: Support Kipu & Mock Monetization -->
        <section class="settings-card monetization-card" aria-labelledby="heading-support">
          <div class="monetization-header">
            <h2 id="heading-support" class="card-title">Support Kipu / Premium Pass</h2>
            <span class="heart-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </span>
          </div>
          <p class="card-desc">Kipu is completely ad-free, tracker-free, and private for all children. Support development with an optional mock contribution!</p>

          <div class="supporter-status-banner" role="status">
            <div class="status-content">
              <span class="status-badge free-status">Free Evaluation Core</span>
              <span class="status-text">All primary games in Sandbox, Workshop, and Lab are unlocked.</span>
            </div>
            <div class="status-actions">
              <button class="settings-btn secondary-btn restore-purchases-btn" aria-label="Restore Purchases">Restore Purchases</button>
              <button class="settings-btn secondary-btn reset-demo-btn hidden" aria-label="Reset Demo Purchases">Reset Demo</button>
            </div>
          </div>

          <div class="tiers-grid" role="list" aria-label="Support Tiers">
            ${DONATION_TIERS.map(tier => `
              <article class="tier-card tier-${tier.id}" role="listitem" data-tier-id="${tier.id}">
                ${tier.badge ? `<span class="tier-badge">${tier.badge}</span>` : ''}
                <div class="tier-card-header">
                  <h3 class="tier-name">${tier.name}</h3>
                  <div class="tier-price-box">
                    <span class="tier-price">${tier.price}</span>
                    <span class="tier-period">one-time</span>
                  </div>
                </div>
                <p class="tier-desc">${tier.description}</p>
                <ul class="tier-perks">
                  ${tier.perks.map(perk => `<li><span class="perk-check">✓</span> <span>${perk}</span></li>`).join('')}
                </ul>
                <button class="tier-action-btn" data-tier-id="${tier.id}" aria-label="Select ${tier.name} for ${tier.price}">
                  Support (${tier.price})
                </button>
              </article>
            `).join('')}
          </div>
        </section>

        <!-- Footer / Return -->
        <footer class="settings-footer">
          <button class="settings-btn primary-btn return-home-btn" aria-label="Return to Game Hub">
            Back to Game Hub
          </button>
          <p class="settings-version">Kipu v4.0.0 — Pure Tactile Learning</p>
        </footer>
      </div>
    `;

    return el;
  }

  private attachEventListeners(): void {
    // Navigation back buttons
    this.element.querySelector('.settings-back-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.config.onBack();
    });

    this.element.querySelector('.return-home-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.config.onBack();
    });

    // Sound toggle
    const soundToggle = this.element.querySelector('.sound-toggle') as HTMLButtonElement;
    soundToggle?.addEventListener('click', () => this.handleSoundToggle());

    // Vibration toggle
    const vibrationToggle = this.element.querySelector('.vibration-toggle') as HTMLButtonElement;
    vibrationToggle?.addEventListener('click', () => this.handleVibrationToggle());

    // High Contrast toggle
    const highContrastToggle = this.element.querySelector('.high-contrast-toggle') as HTMLButtonElement;
    highContrastToggle?.addEventListener('click', () => this.handleHighContrastToggle());

    // Parental gate toggle
    const parentalGateToggle = this.element.querySelector('.parental-gate-toggle') as HTMLButtonElement;
    parentalGateToggle?.addEventListener('click', () => this.handleParentalGateToggle());

    // Parental mode radios
    const modeRadios = this.element.querySelectorAll<HTMLInputElement>('input[name="parental-gate-mode"]');
    modeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.handleParentalGateModeChange(radio.value as 'auto' | 'dual_hold' | 'math');
        }
      });
    });

    // Tier selection buttons
    const tierButtons = this.element.querySelectorAll<HTMLButtonElement>('.tier-action-btn');
    tierButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.dataset.tierId;
        const tier = DONATION_TIERS.find((t) => t.id === tierId);
        if (tier) {
          this.openPurchaseModal(tier);
        }
      });
    });

    // Restore purchases
    this.element.querySelector('.restore-purchases-btn')?.addEventListener('click', () => {
      this.handleRestorePurchases();
    });

    // Reset demo purchases
    this.element.querySelector('.reset-demo-btn')?.addEventListener('click', () => {
      this.handleResetDemoPurchases();
    });
  }

  public syncUIWithState(): void {
    // 1. Sound setting
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const soundToggle = this.element.querySelector('.sound-toggle') as HTMLButtonElement;
    if (soundToggle) {
      soundToggle.classList.toggle('on', soundEnabled);
      soundToggle.setAttribute('aria-checked', String(soundEnabled));
      soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    }

    // 2. Vibration setting
    const vibrationEnabled = localStorage.getItem('vibrationEnabled') !== 'false';
    const vibrationToggle = this.element.querySelector('.vibration-toggle') as HTMLButtonElement;
    if (vibrationToggle) {
      vibrationToggle.classList.toggle('on', vibrationEnabled);
      vibrationToggle.setAttribute('aria-checked', String(vibrationEnabled));
      vibrationToggle.setAttribute('aria-pressed', String(vibrationEnabled));
    }

    // 3. High Contrast setting
    const highContrast = localStorage.getItem('kipu_high_contrast') === 'true';
    const highContrastToggle = this.element.querySelector('.high-contrast-toggle') as HTMLButtonElement;
    if (highContrastToggle) {
      highContrastToggle.classList.toggle('on', highContrast);
      highContrastToggle.setAttribute('aria-checked', String(highContrast));
      highContrastToggle.setAttribute('aria-pressed', String(highContrast));
    }
    document.documentElement.classList.toggle('high-contrast', highContrast);

    // 4. Parental Gate Enabled setting
    const gateEnabled = localStorage.getItem('kipu_parental_gate_enabled') !== 'false';
    const gateToggle = this.element.querySelector('.parental-gate-toggle') as HTMLButtonElement;
    if (gateToggle) {
      gateToggle.classList.toggle('on', gateEnabled);
      gateToggle.setAttribute('aria-checked', String(gateEnabled));
      gateToggle.setAttribute('aria-pressed', String(gateEnabled));
    }

    // 5. Parental Gate Mode setting
    const gateMode = localStorage.getItem('kipu_parental_gate_mode') || 'auto';
    const modeRadio = this.element.querySelector<HTMLInputElement>(`input[name="parental-gate-mode"][value="${gateMode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }

    // 6. Monetization / Unlocked state
    const isUnlocked = localStorage.getItem('kipu_premium_unlocked') === 'true';
    const unlockedTierId = localStorage.getItem('kipu_supporter_tier') || '';
    const unlockedTier = DONATION_TIERS.find((t) => t.id === unlockedTierId);

    const statusBanner = this.element.querySelector('.supporter-status-banner');
    const resetDemoBtn = this.element.querySelector('.reset-demo-btn');
    const restoreBtn = this.element.querySelector('.restore-purchases-btn');

    if (statusBanner) {
      const badge = statusBanner.querySelector('.status-badge');
      const text = statusBanner.querySelector('.status-text');

      if (isUnlocked && unlockedTier) {
        statusBanner.classList.add('unlocked-status');
        if (badge) {
          badge.textContent = `★ Supporter (${unlockedTier.name})`;
          badge.className = 'status-badge premium-status';
        }
        if (text) {
          text.textContent = `Thank you for your generous contribution! All premium toy packs and themes are active.`;
        }
        resetDemoBtn?.classList.remove('hidden');
        restoreBtn?.classList.add('hidden');
      } else {
        statusBanner.classList.remove('unlocked-status');
        if (badge) {
          badge.textContent = 'Free Evaluation Core';
          badge.className = 'status-badge free-status';
        }
        if (text) {
          text.textContent = 'All primary games in Sandbox, Workshop, and Lab are unlocked.';
        }
        resetDemoBtn?.classList.add('hidden');
        restoreBtn?.classList.remove('hidden');
      }
    }

    // Update tier buttons
    const tierCards = this.element.querySelectorAll<HTMLElement>('.tier-card');
    tierCards.forEach((card) => {
      const tierId = card.dataset.tierId;
      const btn = card.querySelector<HTMLButtonElement>('.tier-action-btn');
      if (!btn) return;

      if (isUnlocked && tierId === unlockedTierId) {
        card.classList.add('active-tier');
        btn.textContent = '✓ Active Tier';
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else if (isUnlocked) {
        card.classList.remove('active-tier');
        btn.textContent = 'Switch / Re-Support';
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        card.classList.remove('active-tier');
        const tier = DONATION_TIERS.find((t) => t.id === tierId);
        btn.textContent = tier ? `Support (${tier.price})` : 'Support';
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  private handleSoundToggle(): void {
    const currentState = localStorage.getItem('soundEnabled') !== 'false';
    const newState = !currentState;
    localStorage.setItem('soundEnabled', String(newState));
    this.syncUIWithState();
    this.config.onSoundToggle?.(newState);
  }

  private handleVibrationToggle(): void {
    const currentState = localStorage.getItem('vibrationEnabled') !== 'false';
    const newState = !currentState;
    localStorage.setItem('vibrationEnabled', String(newState));
    this.syncUIWithState();
    this.config.onVibrationToggle?.(newState);
  }

  private handleHighContrastToggle(): void {
    const currentState = localStorage.getItem('kipu_high_contrast') === 'true';
    const newState = !currentState;
    localStorage.setItem('kipu_high_contrast', String(newState));
    this.syncUIWithState();
    this.config.onHighContrastToggle?.(newState);
  }

  private handleParentalGateToggle(): void {
    const currentState = localStorage.getItem('kipu_parental_gate_enabled') !== 'false';
    const newState = !currentState;
    localStorage.setItem('kipu_parental_gate_enabled', String(newState));
    this.syncUIWithState();
    this.config.onParentalGateToggle?.(newState);
  }

  private handleParentalGateModeChange(mode: 'auto' | 'dual_hold' | 'math'): void {
    localStorage.setItem('kipu_parental_gate_mode', mode);
    this.syncUIWithState();
    this.config.onParentalGateModeChange?.(mode);
  }

  private handleRestorePurchases(): void {
    const isUnlocked = localStorage.getItem('kipu_premium_unlocked') === 'true';
    const unlockedTier = localStorage.getItem('kipu_supporter_tier');
    if (isUnlocked && unlockedTier) {
      this.syncUIWithState();
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Purchases restored: active supporter tier verified.');
      }
    } else {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('No previous purchases found on this device.');
      }
    }
  }

  private handleResetDemoPurchases(): void {
    localStorage.removeItem('kipu_premium_unlocked');
    localStorage.removeItem('kipu_supporter_tier');
    this.syncUIWithState();
  }

  public openPurchaseModal(tier: DonationTier): void {
    this.closePurchaseModal();

    const backdrop = document.createElement('div');
    backdrop.id = 'purchase-modal-backdrop';
    backdrop.className = 'payment-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'modal-dialog-title');

    backdrop.innerHTML = `
      <div class="payment-modal-dialog">
        <header class="payment-modal-header">
          <h3 id="modal-dialog-title" class="payment-modal-title">Confirm Mock Contribution</h3>
          <button class="payment-modal-close-btn" aria-label="Close dialog">✕</button>
        </header>

        <div class="payment-modal-body">
          <div class="modal-tier-summary">
            <span class="modal-tier-name">${tier.name}</span>
            <span class="modal-tier-price">${tier.price}</span>
          </div>
          <p class="modal-tier-desc">${tier.description}</p>

          <div class="mock-sandbox-notice">
            <span class="notice-icon" aria-hidden="true">ℹ</span>
            <span class="notice-text">
              <strong>Simulated Sandbox Transaction</strong>: No real money or credit card will be charged. This simulates an in-app purchase flow for testing.
            </span>
          </div>

          <div class="modal-processing-state hidden" aria-live="polite">
            <div class="spinner" aria-hidden="true"></div>
            <p class="processing-label">Contacting simulated app store gateway...</p>
          </div>

          <div class="modal-success-state hidden" aria-live="polite">
            <div class="success-badge" aria-hidden="true">✓</div>
            <h4 class="success-title">Mock Purchase Successful!</h4>
            <p class="success-desc">Thank you for supporting Kipu! Unlock status has been recorded.</p>
          </div>
        </div>

        <footer class="payment-modal-footer">
          <button class="modal-btn cancel-btn" aria-label="Cancel purchase">Cancel</button>
          <button class="modal-btn confirm-btn" aria-label="Confirm simulated purchase of ${tier.name} for ${tier.price}">
            Confirm Mock Purchase (${tier.price})
          </button>
          <button class="modal-btn done-btn hidden" aria-label="Close dialog and finish">Done</button>
        </footer>
      </div>
    `;

    document.body.appendChild(backdrop);
    this.activeModal = backdrop;

    // Attach listeners
    const closeBtn = backdrop.querySelector('.payment-modal-close-btn');
    const cancelBtn = backdrop.querySelector('.cancel-btn');
    const confirmBtn = backdrop.querySelector('.confirm-btn') as HTMLButtonElement;
    const doneBtn = backdrop.querySelector('.done-btn');

    closeBtn?.addEventListener('click', () => this.closePurchaseModal());
    cancelBtn?.addEventListener('click', () => this.closePurchaseModal());
    doneBtn?.addEventListener('click', () => this.closePurchaseModal());

    confirmBtn?.addEventListener('click', () => {
      this.executeMockPurchase(tier, backdrop);
    });

    // Close on backdrop click (outside dialog)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.closePurchaseModal();
      }
    });

    // Focus trap and Escape listener
    this.focusTrapCleanup = this.setupModalFocusTrap(backdrop);
  }

  private executeMockPurchase(tier: DonationTier, modal: HTMLElement): void {
    const cancelBtn = modal.querySelector('.cancel-btn') as HTMLButtonElement;
    const confirmBtn = modal.querySelector('.confirm-btn') as HTMLButtonElement;
    const doneBtn = modal.querySelector('.done-btn') as HTMLButtonElement;
    const processingEl = modal.querySelector('.modal-processing-state');
    const successEl = modal.querySelector('.modal-success-state');

    // Enter processing state
    cancelBtn?.classList.add('hidden');
    confirmBtn?.classList.add('hidden');
    processingEl?.classList.remove('hidden');

    const finalize = () => {
      // Save unlock status
      localStorage.setItem('kipu_premium_unlocked', 'true');
      localStorage.setItem('kipu_supporter_tier', tier.id);

      // Trigger tactile haptics
      HapticController.getInstance().success();

      // Transition to success state
      processingEl?.classList.add('hidden');
      successEl?.classList.remove('hidden');
      doneBtn?.classList.remove('hidden');
      doneBtn?.focus();

      // Sync settings view
      this.syncUIWithState();
      this.config.onTierPurchased?.(tier.id);
    };

    if (this.config.skipProcessingDelay) {
      finalize();
    } else {
      setTimeout(finalize, 900);
    }
  }

  public closePurchaseModal(): void {
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }

  private setupModalFocusTrap(modal: HTMLElement): () => void {
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableEls = modal.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstFocusable = focusableEls[0];
    const lastFocusable = focusableEls[focusableEls.length - 1];

    firstFocusable?.focus();

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closePurchaseModal();
        return;
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', keyHandler);

    return () => {
      window.removeEventListener('keydown', keyHandler);
    };
  }
}
