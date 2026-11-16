import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsView, DONATION_TIERS } from '../src/ui/SettingsView';
import { HapticController } from '../src/core/HapticController';

describe('SettingsView Component, Mock Monetization & Persistence', () => {
  let onBack: () => void;
  let onSoundToggle: (enabled: boolean) => void;
  let onVibrationToggle: (enabled: boolean) => void;
  let onHighContrastToggle: (enabled: boolean) => void;
  let onParentalGateModeChange: (mode: 'auto' | 'dual_hold' | 'math') => void;
  let onParentalGateToggle: (enabled: boolean) => void;
  let onTierPurchased: (tierId: string) => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
    localStorage.clear();

    onBack = vi.fn();
    onSoundToggle = vi.fn();
    onVibrationToggle = vi.fn();
    onHighContrastToggle = vi.fn();
    onParentalGateModeChange = vi.fn();
    onParentalGateToggle = vi.fn();
    onTierPurchased = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  describe('1. Mounting, Layout & Sitewright Standards', () => {
    it('mounts SettingsView into container with zero inline style attributes', () => {
      const view = new SettingsView({
        onBack,
        onSoundToggle,
        onVibrationToggle,
        onHighContrastToggle,
      });

      view.mount(document.body);

      const el = document.getElementById('settings-view');
      expect(el).not.toBeNull();
      expect(el?.getAttribute('style')).toBeNull();

      const allDescendants = el?.querySelectorAll('*') || [];
      expect(allDescendants.length).toBeGreaterThan(0);
      allDescendants.forEach((child) => {
        expect(child.getAttribute('style')).toBeNull();
      });

      view.unmount();
    });

    it('renders all primary sections and header navigation controls', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      expect(document.querySelector('.settings-title')?.textContent).toContain('Settings & Support');
      expect(document.querySelector('.settings-back-btn')).not.toBeNull();
      expect(document.querySelector('.return-home-btn')).not.toBeNull();
      expect(document.getElementById('heading-sensory')).not.toBeNull();
      expect(document.getElementById('heading-accessibility')).not.toBeNull();
      expect(document.getElementById('heading-parental')).not.toBeNull();
      expect(document.getElementById('heading-support')).not.toBeNull();

      view.unmount();
    });

    it('triggers onBack callback when back button or return button is clicked', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const backBtn = document.querySelector('.settings-back-btn') as HTMLButtonElement;
      backBtn.click();
      expect(onBack).toHaveBeenCalledTimes(1);

      const returnBtn = document.querySelector('.return-home-btn') as HTMLButtonElement;
      returnBtn.click();
      expect(onBack).toHaveBeenCalledTimes(2);

      view.unmount();
    });
  });

  describe('2. Audio, Haptics & Accessibility Settings Controls', () => {
    it('toggles sound setting, updates ARIA attributes, and persists in localStorage', () => {
      localStorage.setItem('soundEnabled', 'true');

      const view = new SettingsView({ onBack, onSoundToggle });
      view.mount(document.body);

      const soundToggle = document.querySelector('.sound-toggle') as HTMLButtonElement;
      expect(soundToggle.classList.contains('on')).toBe(true);
      expect(soundToggle.getAttribute('aria-checked')).toBe('true');

      // Click to toggle off
      soundToggle.click();
      expect(localStorage.getItem('soundEnabled')).toBe('false');
      expect(soundToggle.classList.contains('on')).toBe(false);
      expect(soundToggle.getAttribute('aria-checked')).toBe('false');
      expect(onSoundToggle).toHaveBeenCalledWith(false);

      // Click to toggle back on
      soundToggle.click();
      expect(localStorage.getItem('soundEnabled')).toBe('true');
      expect(soundToggle.classList.contains('on')).toBe(true);
      expect(soundToggle.getAttribute('aria-checked')).toBe('true');
      expect(onSoundToggle).toHaveBeenCalledWith(true);

      view.unmount();
    });

    it('toggles vibration setting, updates ARIA attributes, and persists in localStorage', () => {
      localStorage.setItem('vibrationEnabled', 'true');

      const view = new SettingsView({ onBack, onVibrationToggle });
      view.mount(document.body);

      const vibrationToggle = document.querySelector('.vibration-toggle') as HTMLButtonElement;
      expect(vibrationToggle.classList.contains('on')).toBe(true);

      vibrationToggle.click();
      expect(localStorage.getItem('vibrationEnabled')).toBe('false');
      expect(vibrationToggle.classList.contains('on')).toBe(false);
      expect(onVibrationToggle).toHaveBeenCalledWith(false);

      view.unmount();
    });

    it('toggles high contrast mode, updates document root class, and persists in localStorage', () => {
      localStorage.setItem('kipu_high_contrast', 'false');

      const view = new SettingsView({ onBack, onHighContrastToggle });
      view.mount(document.body);

      const contrastToggle = document.querySelector('.high-contrast-toggle') as HTMLButtonElement;
      expect(contrastToggle.classList.contains('on')).toBe(false);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);

      // Click to toggle on
      contrastToggle.click();
      expect(localStorage.getItem('kipu_high_contrast')).toBe('true');
      expect(contrastToggle.classList.contains('on')).toBe(true);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
      expect(onHighContrastToggle).toHaveBeenCalledWith(true);

      // Click to toggle off
      contrastToggle.click();
      expect(localStorage.getItem('kipu_high_contrast')).toBe('false');
      expect(contrastToggle.classList.contains('on')).toBe(false);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
      expect(onHighContrastToggle).toHaveBeenCalledWith(false);

      view.unmount();
    });
  });

  describe('3. Parental Gate Security Controls', () => {
    it('toggles parental gate active state and persists to localStorage', () => {
      const view = new SettingsView({ onBack, onParentalGateToggle });
      view.mount(document.body);

      const gateToggle = document.querySelector('.parental-gate-toggle') as HTMLButtonElement;
      expect(gateToggle.classList.contains('on')).toBe(true);

      gateToggle.click();
      expect(localStorage.getItem('kipu_parental_gate_enabled')).toBe('false');
      expect(gateToggle.classList.contains('on')).toBe(false);
      expect(onParentalGateToggle).toHaveBeenCalledWith(false);

      view.unmount();
    });

    it('selects parental gate verification mode and persists to localStorage', () => {
      const view = new SettingsView({ onBack, onParentalGateModeChange });
      view.mount(document.body);

      const dualHoldRadio = document.querySelector('input[value="dual_hold"]') as HTMLInputElement;
      expect(dualHoldRadio).not.toBeNull();

      dualHoldRadio.click();
      dualHoldRadio.dispatchEvent(new Event('change'));

      expect(localStorage.getItem('kipu_parental_gate_mode')).toBe('dual_hold');
      expect(onParentalGateModeChange).toHaveBeenCalledWith('dual_hold');

      const mathRadio = document.querySelector('input[value="math"]') as HTMLInputElement;
      mathRadio.click();
      mathRadio.dispatchEvent(new Event('change'));

      expect(localStorage.getItem('kipu_parental_gate_mode')).toBe('math');
      expect(onParentalGateModeChange).toHaveBeenCalledWith('math');

      view.unmount();
    });
  });

  describe('4. Mock Monetization UI, Donation Tiers & Persistence', () => {
    it('renders all 3 mock donation tiers with correct pricing and perks', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      expect(DONATION_TIERS.length).toBe(3);
      expect(DONATION_TIERS[0].name).toBe('Supporter Coffee');
      expect(DONATION_TIERS[0].price).toBe('$2.00');

      expect(DONATION_TIERS[1].name).toBe('Toy Box Pack');
      expect(DONATION_TIERS[1].price).toBe('$5.00');

      expect(DONATION_TIERS[2].name).toBe('Lifetime Explorer');
      expect(DONATION_TIERS[2].price).toBe('$10.00');

      const tierCards = document.querySelectorAll('.tier-card');
      expect(tierCards.length).toBe(3);

      view.unmount();
    });

    it('opens confirmation modal with mock payment disclaimer when tier button is clicked', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const coffeeBtn = document.querySelector('button[data-tier-id="supporter_coffee"]') as HTMLButtonElement;
      coffeeBtn.click();

      const modal = document.getElementById('purchase-modal-backdrop');
      expect(modal).not.toBeNull();
      expect(modal?.getAttribute('role')).toBe('dialog');
      expect(modal?.getAttribute('aria-modal')).toBe('true');
      expect(modal?.textContent).toContain('Supporter Coffee');
      expect(modal?.textContent).toContain('$2.00');
      expect(modal?.textContent).toContain('Simulated Sandbox Transaction');

      view.unmount();
    });

    it('closes modal without unlocking when Cancel button is clicked', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const toyBoxBtn = document.querySelector('button[data-tier-id="toy_box_pack"]') as HTMLButtonElement;
      toyBoxBtn.click();

      const modal = document.getElementById('purchase-modal-backdrop');
      expect(modal).not.toBeNull();

      const cancelBtn = modal?.querySelector('.cancel-btn') as HTMLButtonElement;
      cancelBtn.click();

      expect(document.getElementById('purchase-modal-backdrop')).toBeNull();
      expect(localStorage.getItem('kipu_premium_unlocked')).toBeNull();

      view.unmount();
    });

    it('simulates purchase, saves unlock state to localStorage, and triggers haptic success', () => {
      const hapticSuccessSpy = vi.spyOn(HapticController.getInstance(), 'success');

      const view = new SettingsView({
        onBack,
        onTierPurchased,
        skipProcessingDelay: true,
      });
      view.mount(document.body);

      const lifetimeBtn = document.querySelector('button[data-tier-id="lifetime_explorer"]') as HTMLButtonElement;
      lifetimeBtn.click();

      const modal = document.getElementById('purchase-modal-backdrop');
      const confirmBtn = modal?.querySelector('.confirm-btn') as HTMLButtonElement;
      confirmBtn.click();

      // State saved to localStorage
      expect(localStorage.getItem('kipu_premium_unlocked')).toBe('true');
      expect(localStorage.getItem('kipu_supporter_tier')).toBe('lifetime_explorer');
      expect(hapticSuccessSpy).toHaveBeenCalled();
      expect(onTierPurchased).toHaveBeenCalledWith('lifetime_explorer');

      // Success UI visible
      expect(modal?.querySelector('.modal-success-state')?.classList.contains('hidden')).toBe(false);

      // Close modal
      const doneBtn = modal?.querySelector('.done-btn') as HTMLButtonElement;
      doneBtn.click();

      expect(document.getElementById('purchase-modal-backdrop')).toBeNull();

      // Status banner reflects unlocked tier
      const banner = document.querySelector('.supporter-status-banner');
      expect(banner?.textContent).toContain('Supporter (Lifetime Explorer)');

      view.unmount();
    });

    it('resets demo purchases when Reset Demo button is clicked', () => {
      localStorage.setItem('kipu_premium_unlocked', 'true');
      localStorage.setItem('kipu_supporter_tier', 'toy_box_pack');

      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const banner = document.querySelector('.supporter-status-banner');
      expect(banner?.textContent).toContain('Supporter (Toy Box Pack)');

      const resetBtn = document.querySelector('.reset-demo-btn') as HTMLButtonElement;
      expect(resetBtn.classList.contains('hidden')).toBe(false);

      resetBtn.click();

      expect(localStorage.getItem('kipu_premium_unlocked')).toBeNull();
      expect(localStorage.getItem('kipu_supporter_tier')).toBeNull();
      expect(banner?.textContent).toContain('Free Evaluation Core');

      view.unmount();
    });

    it('closes modal on Escape key press', () => {
      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const btn = document.querySelector('button[data-tier-id="supporter_coffee"]') as HTMLButtonElement;
      btn.click();

      expect(document.getElementById('purchase-modal-backdrop')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(document.getElementById('purchase-modal-backdrop')).toBeNull();

      view.unmount();
    });

    it('handles restore purchases gracefully', () => {
      const alertSpy = vi.fn();
      window.alert = alertSpy;

      const view = new SettingsView({ onBack });
      view.mount(document.body);

      const restoreBtn = document.querySelector('.restore-purchases-btn') as HTMLButtonElement;
      restoreBtn.click();
      expect(alertSpy).toHaveBeenCalled();

      view.unmount();
    });
  });
});
