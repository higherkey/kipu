import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../src/core/Router';
import { ParentalGate } from '../src/ui/ParentalGate';
import { GameUI } from '../src/ui/GameUI';

describe('Safe Exit Flow & Navigation Guards (#16, #28)', () => {
  let router: Router;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = '';
    document.documentElement.className = '';
    localStorage.clear();
    router = new Router();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
    ParentalGate.getInstance().destroy();
    router?.destroy();
    vi.restoreAllMocks();
  });

  describe('1. Router beforeEach Middleware Architecture', () => {
    it('executes registered guard with to and from parameters', async () => {
      const guardSpy = vi.fn().mockReturnValue(true);
      router.beforeEach(guardSpy);

      router.addRoute('/', vi.fn());
      router.addRoute('/target', vi.fn());
      router.init();

      await router.navigate('/target');

      expect(guardSpy).toHaveBeenCalledWith('/target', '/');
      expect(window.location.pathname).toBe('/target');
    });

    it('aborts navigation when guard returns false', async () => {
      const targetHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/protected', targetHandler);
      router.init();

      router.beforeEach((to) => {
        if (to === '/protected') return false;
        return true;
      });

      const allowed = await router.navigate('/protected');

      expect(allowed).toBe(false);
      expect(targetHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');
    });

    it('redirects when guard returns a string path', async () => {
      const targetHandler = vi.fn();
      const redirectHandler = vi.fn();

      router.addRoute('/', vi.fn());
      router.addRoute('/old', targetHandler);
      router.addRoute('/new', redirectHandler);
      router.init();

      router.beforeEach((to) => {
        if (to === '/old') return '/new';
        return true;
      });

      await router.navigate('/old');

      expect(targetHandler).not.toHaveBeenCalled();
      expect(redirectHandler).toHaveBeenCalled();
      expect(window.location.pathname).toBe('/new');
    });

    it('allows unregistering guards via returned disposer function', async () => {
      const guard = vi.fn().mockReturnValue(false);
      const unregister = router.beforeEach(guard);

      router.addRoute('/', vi.fn());
      router.addRoute('/test', vi.fn());
      router.init();

      // Guard is active: blocks
      const firstTry = await router.navigate('/test');
      expect(firstTry).toBe(false);

      // Unregister guard
      unregister();

      // Now navigation proceeds
      const secondTry = await router.navigate('/test');
      expect(secondTry).toBe(true);
      expect(window.location.pathname).toBe('/test');
    });
  });

  describe('2. Browser Popstate & Back Button Interception (History Lock)', () => {
    it('locks history at from path when popstate guard cancels', async () => {
      const gameHandler = vi.fn();
      const homeHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/', homeHandler);

      // Navigate to game
      router.navigate('/game/bubbleWrap');
      expect(router.getCurrentPath()).toBe('/game/bubbleWrap');

      let verifyCallback: ((pass: boolean) => void) | null = null;
      router.beforeEach((to, from) => {
        if (from?.startsWith('/game/') && to !== from) {
          return new Promise<boolean>((resolve) => {
            verifyCallback = resolve;
          });
        }
        return true;
      });

      // User presses browser back button (simulating popstate to '/')
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));

      // The guard is currently pending
      expect(verifyCallback).not.toBeNull();

      // Simulate toddler cancelling the gate
      verifyCallback!(false);
      await new Promise((r) => setTimeout(r, 0));

      // Home handler should NOT have executed; current URL restored to game
      expect(homeHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/game/bubbleWrap');
    });

    it('proceeds with navigation on popstate when guard confirms', async () => {
      const homeHandler = vi.fn();
      router.addRoute('/game/bubbleWrap', vi.fn());
      router.addRoute('/', homeHandler);

      router.navigate('/game/bubbleWrap');

      let verifyCallback: ((pass: boolean) => void) | null = null;
      router.beforeEach((to, from) => {
        if (from?.startsWith('/game/') && to !== from) {
          return new Promise<boolean>((resolve) => {
            verifyCallback = resolve;
          });
        }
        return true;
      });

      // Browser back button
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(verifyCallback).not.toBeNull();

      // Parent succeeds at the gate
      verifyCallback!(true);
      await new Promise((r) => setTimeout(r, 0));

      expect(homeHandler).toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');
    });
  });

  describe('3. Game Lifecycle Preservation & Canvas Class Locking', () => {
    it('applies parental-gate-open and interaction-locked without inline styles', async () => {
      const canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      document.body.appendChild(canvas);

      const pauseSpy = vi.fn();
      const resumeSpy = vi.fn();

      router.addRoute('/game/test', vi.fn());
      router.addRoute('/', vi.fn());
      router.navigate('/game/test');

      let gatePass: (() => void) | null = null;
      let gateCancel: (() => void) | null = null;

      router.beforeEach(async (to, from) => {
        if (from?.startsWith('/game/') && to !== from) {
          pauseSpy();
          document.body.classList.add('parental-gate-open');
          canvas.classList.add('interaction-locked');

          return new Promise<boolean>((resolve) => {
            gatePass = () => {
              document.body.classList.remove('parental-gate-open');
              canvas.classList.remove('interaction-locked');
              resolve(true);
            };
            gateCancel = () => {
              document.body.classList.remove('parental-gate-open');
              canvas.classList.remove('interaction-locked');
              resumeSpy();
              resolve(false);
            };
          });
        }
        return true;
      });

      // Trigger exit
      const navPromise = router.navigate('/');

      expect(pauseSpy).toHaveBeenCalledTimes(1);
      expect(document.body.classList.contains('parental-gate-open')).toBe(true);
      expect(canvas.classList.contains('interaction-locked')).toBe(true);
      expect(canvas.getAttribute('style')).toBeNull();

      // Cancel exit
      gateCancel!();
      const result = await navPromise;

      expect(result).toBe(false);
      expect(resumeSpy).toHaveBeenCalledTimes(1);
      expect(document.body.classList.contains('parental-gate-open')).toBe(false);
      expect(canvas.classList.contains('interaction-locked')).toBe(false);
      expect(canvas.getAttribute('style')).toBeNull();

      canvas.remove();
    });
  });

  describe('4. In-Game Menu Safe Exit Actions', () => {
    it('wires Exit to Hub and Parent Settings actions in GameUI slide menu', () => {
      const onHome = vi.fn();
      const onSettingsNav = vi.fn();

      const gameUI = new GameUI({
        gameName: 'Safe Navigation Test Game',
        onHome,
        onPause: vi.fn(),
        onResume: vi.fn(),
        onRestart: vi.fn(),
        soundEnabled: true,
        vibrationEnabled: true,
        onSoundToggle: vi.fn(),
        onVibrationToggle: vi.fn(),
        onSettingsNav,
      });

      gameUI.mount();

      const exitHubBtn = document.querySelector('.exit-hub-btn') as HTMLButtonElement;
      const settingsBtn = document.querySelector('.parent-settings-btn') as HTMLButtonElement;

      expect(exitHubBtn).not.toBeNull();
      expect(settingsBtn).not.toBeNull();

      // Clicking Exit to Hub triggers onHome
      exitHubBtn.click();
      expect(onHome).toHaveBeenCalledTimes(1);

      // Clicking Parent Settings triggers onSettingsNav
      settingsBtn.click();
      expect(onSettingsNav).toHaveBeenCalledTimes(1);

      gameUI.unmount();
    });
  });

  describe('5. Protected Settings Route Shielding & Initial Hydration (#16, #28)', () => {
    it('triggers ParentalGate when navigating to #/settings hash format and cancels navigation on dismissal', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);

      // Settings guard matching main.ts
      router.beforeEach(async (to) => {
        const normalized = to.replace(/^#/, '').replace(/^\/?/, '/');
        if (normalized === '/settings' || normalized.startsWith('/settings')) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false)
            );
          });
        }
        return true;
      });

      // 1. Toddler attempts hash navigation to #/settings
      const navPromise = router.navigate('#/settings');

      // Verify ParentalGate modal overlay opened
      const overlay = document.getElementById('parental-gate-overlay');
      expect(overlay).not.toBeNull();
      expect(settingsHandler).not.toHaveBeenCalled();

      // 2. Simulate toddler dismissing gate via close button
      const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
      closeBtn.click();

      const allowed = await navPromise;
      expect(allowed).toBe(false);
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');
    });

    it('allows entry to /settings when navigating via #/settings upon completing ParentalGate challenge', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        const normalized = to.replace(/^#/, '').replace(/^\/?/, '/');
        if (normalized === '/settings' || normalized.startsWith('/settings')) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false),
              { mode: 'math' }
            );
          });
        }
        return true;
      });

      const navPromise = router.navigate('#/settings');

      // Parent completes math challenge
      const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
      const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
      expect(match).not.toBeNull();

      const a = parseInt(match![1], 10);
      const op = match![2];
      const b = parseInt(match![3], 10);
      const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

      const correctBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer === String(correct)
      ) as HTMLButtonElement;

      correctBtn.click();

      const allowed = await navPromise;
      expect(allowed).toBe(true);
      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/settings');
    });

    it('intercepts initial boot at /settings, displaying ParentalGate and redirecting to / on cancel', async () => {
      window.history.replaceState({}, '', '/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        const normalized = to.replace(/^#/, '').replace(/^\/?/, '/');
        if (normalized === '/settings' || normalized.startsWith('/settings')) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false)
            );
          });
        }
        return true;
      });

      const initPromise = router.init();

      // Parental gate modal must be mounted
      const overlay = document.getElementById('parental-gate-overlay');
      expect(overlay).not.toBeNull();
      expect(settingsHandler).not.toHaveBeenCalled();

      // Toddler cancels gate
      const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
      closeBtn.click();

      await initPromise;

      // Must redirect to home /
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(homeHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/');
    });

    it('intercepts initial boot at /settings, allowing route entry when ParentalGate succeeds', async () => {
      window.history.replaceState({}, '', '/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        const normalized = to.replace(/^#/, '').replace(/^\/?/, '/');
        if (normalized === '/settings' || normalized.startsWith('/settings')) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false),
              { mode: 'math' }
            );
          });
        }
        return true;
      });

      const initPromise = router.init();

      // Solve math challenge
      const promptText = document.getElementById('parental-gate-math-prompt')?.textContent || '';
      const match = promptText.match(/What is (\d+) ([+\-*×]) (\d+)\?/);
      expect(match).not.toBeNull();

      const a = parseInt(match![1], 10);
      const op = match![2];
      const b = parseInt(match![3], 10);
      const correct = op === '+' ? a + b : op === '-' ? a - b : a * b;

      const correctBtn = Array.from(document.querySelectorAll('.parental-gate-choice-btn')).find(
        (btn) => (btn as HTMLElement).dataset.answer === String(correct)
      ) as HTMLButtonElement;

      correctBtn.click();

      await initPromise;

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(homeHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings');
    });

    it('executes navigation guard on initial boot at #/settings and mounts /settings on pass', async () => {
      window.history.replaceState({}, '', '/#/settings');

      let gateTriggered = false;
      let settingsEntered = false;

      router.addRoute('/', vi.fn());
      router.addRoute('/settings', () => {
        settingsEntered = true;
      });

      router.beforeEach(async (to, from) => {
        expect(from).toBeNull();
        if (to === '/settings' || to.startsWith('/settings')) {
          gateTriggered = true;
          return true; // Parent passes gate on boot
        }
        return true;
      });

      await router.init();

      expect(gateTriggered).toBe(true);
      expect(settingsEntered).toBe(true);
      expect(router.getCurrentPath()).toBe('/settings');
    });

    it('normalizes to and from on browser popstate before guard evaluation', async () => {
      const gameHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/settings', settingsHandler);

      await router.navigate('/game/bubbleWrap');

      let observedTo = '';
      let observedFrom = '';

      router.beforeEach((to, from) => {
        observedTo = to;
        observedFrom = from || '';
        return false; // Block
      });

      // User triggers popstate with hash path
      window.history.pushState({}, '', '#/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(observedTo).toBe('/settings');
      expect(observedFrom).toBe('/game/bubbleWrap');
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/game/bubbleWrap');
    });
  });
});
