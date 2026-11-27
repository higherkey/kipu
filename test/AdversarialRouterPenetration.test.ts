import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../src/core/Router';
import { ParentalGate } from '../src/ui/ParentalGate';

describe('Adversarial Router Penetration & Route Shielding Tests (#16, #28)', () => {
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

  describe('Vector 1: Hash Fragmentation & Query Bypass Attacks', () => {
    const maliciousPaths = [
      { input: '#/settings', expectedNormalized: '/settings' },
      { input: '#settings', expectedNormalized: '/settings' },
      { input: '#/settings/', expectedNormalized: '/settings' },
      { input: '///settings///', expectedNormalized: '/settings' },
      { input: '#/settings?discount=100#nested', expectedNormalized: '/settings' },
      { input: '#/settings/billing', expectedNormalized: '/settings/billing' },
      { input: '///settings?token=evil///#frag', expectedNormalized: '/settings' },
      { input: '#/settings?foo=bar&baz=1#deep#hash', expectedNormalized: '/settings' },
      { input: '#//settings///', expectedNormalized: '/settings' },
      { input: '  #/settings?query=1  ', expectedNormalized: '/settings' },
      { input: '#/settings/billing/invoices?paid=false#summary', expectedNormalized: '/settings/billing/invoices' },
    ];

    maliciousPaths.forEach(({ input, expectedNormalized }) => {
      it(`normalizePath directly canonicalizes "${input}" -> "${expectedNormalized}"`, () => {
        expect(router.normalizePath(input)).toBe(expectedNormalized);
      });

      it(`navigate("${input}") passes normalized path to beforeEach and triggers guard`, async () => {
        let interceptedTo = '';
        let interceptedFrom: string | null = null;
        const settingsHandler = vi.fn();
        const billingHandler = vi.fn();

        router.addRoute('/', vi.fn());
        router.addRoute('/settings', settingsHandler);
        router.addRoute('/settings/billing', billingHandler);

        router.beforeEach(async (to, from) => {
          interceptedTo = to;
          interceptedFrom = from;
          // Reject settings and any subroutes
          if (to === '/settings' || to.startsWith('/settings/')) {
            return false;
          }
          return true;
        });

        const allowed = await router.navigate(input);

        expect(interceptedTo).toBe(expectedNormalized);
        expect(interceptedFrom).toBe('/');
        expect(allowed).toBe(false);
        expect(settingsHandler).not.toHaveBeenCalled();
        expect(billingHandler).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/');
      });

      it(`navigate("${input}") executes handler when guard allows access`, async () => {
        const handler = vi.fn();
        router.addRoute(expectedNormalized, handler);

        router.beforeEach(async () => true);

        const allowed = await router.navigate(input);

        expect(allowed).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe(expectedNormalized);
      });
    });

    it('intercepts anchor clicks with malicious hash hrefs, normalizes, and runs guards', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);
      router.init();

      let guardCalledWith = '';
      router.beforeEach((to) => {
        guardCalledWith = to;
        return false; // Block
      });

      const anchor = document.createElement('a');
      anchor.href = '#/settings?bypass=true#fragment';
      anchor.textContent = 'Settings Link';
      document.body.appendChild(anchor);

      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
      expect(guardCalledWith).toBe('/settings');
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');

      anchor.remove();
    });
  });

  describe('Vector 2: Cold Boot & Hydration Penetration', () => {
    it('penetrates cold boot at "#/settings" with window.location.hash: blocks when guard rejects', async () => {
      window.history.replaceState({}, '', '/#/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      let guardEvaluated = false;
      router.beforeEach(async (to, from) => {
        expect(from).toBeNull();
        if (to === '/settings') {
          guardEvaluated = true;
          return false; // Toddler cancels or gate fails
        }
        return true;
      });

      await router.init();

      expect(guardEvaluated).toBe(true);
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(homeHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/');
      expect(router.getCurrentPath()).toBe('/');
    });

    it('penetrates cold boot at "#/settings" with window.location.hash: permits when guard approves', async () => {
      window.history.replaceState({}, '', '/#/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        if (to === '/settings') {
          return true; // Parent unlocks
        }
        return false;
      });

      await router.init();

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(homeHandler).not.toHaveBeenCalled();
      expect(router.getCurrentPath()).toBe('/settings');
    });

    it('penetrates cold boot at direct pathname "/settings": permits when guard approves', async () => {
      window.history.replaceState({}, '', '/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        if (to === '/settings') {
          return true; // Parent unlocks
        }
        return false;
      });

      await router.init();

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(homeHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings');
      expect(router.getCurrentPath()).toBe('/settings');
    });

    it('penetrates cold boot at direct pathname "/settings" without hash: blocks when guard rejects', async () => {
      window.history.replaceState({}, '', '/settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        if (to === '/settings') {
          return false;
        }
        return true;
      });

      await router.init();

      expect(settingsHandler).not.toHaveBeenCalled();
      expect(homeHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/');
    });

    it('penetrates cold boot at "#settings" (no slash): normalizes and runs guard', async () => {
      window.history.replaceState({}, '', '/#settings');
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      let evaluatedTo = '';
      router.beforeEach(async (to) => {
        evaluatedTo = to;
        if (to === '/settings') {
          return false;
        }
        return true;
      });

      await router.init();

      expect(evaluatedTo).toBe('/settings');
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(homeHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/');
    });

    it('handles cold boot guard redirecting to string path', async () => {
      window.history.replaceState({}, '', '/#/settings');
      const homeHandler = vi.fn();
      const sandboxHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/portal/sandbox', sandboxHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        if (to === '/settings') {
          return '/portal/sandbox'; // Redirect to sandbox
        }
        return true;
      });

      await router.init();

      expect(settingsHandler).not.toHaveBeenCalled();
      expect(homeHandler).not.toHaveBeenCalled();
      expect(sandboxHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/portal/sandbox');
      expect(router.getCurrentPath()).toBe('/portal/sandbox');
    });

    it('handles cold boot at public root "/" synchronously without guard blocking', () => {
      window.history.replaceState({}, '', '/');
      const homeHandler = vi.fn();
      const guardSpy = vi.fn().mockReturnValue(false);

      router.addRoute('/', homeHandler);
      router.beforeEach(guardSpy);

      // Synchronous invocation
      const result = router.init();

      expect(result).toBeUndefined(); // Void, not a Promise
      expect(homeHandler).toHaveBeenCalledTimes(1);
      expect(guardSpy).not.toHaveBeenCalled(); // Public root does not evaluate beforeEach guards
      expect(router.getCurrentPath()).toBe('/');
    });
  });

  describe('Vector 3: Popstate & History Traversal Attacks', () => {
    it('locks history at active game when popstate fires to "#/settings" and guard rejects', async () => {
      const gameHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/settings', settingsHandler);

      await router.navigate('/game/bubbleWrap');
      expect(router.getCurrentPath()).toBe('/game/bubbleWrap');
      expect(gameHandler).toHaveBeenCalledTimes(1);

      let guardCheckedTo = '';
      let guardCheckedFrom = '';
      router.beforeEach((to, from) => {
        guardCheckedTo = to;
        guardCheckedFrom = from || '';
        if (to === '/settings') {
          return false; // Toddler rejects ParentalGate
        }
        return true;
      });

      // Browser popstate dispatched with hash
      window.history.pushState({}, '', '#/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(guardCheckedTo).toBe('/settings');
      expect(guardCheckedFrom).toBe('/game/bubbleWrap');
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/game/bubbleWrap');
      expect(router.getCurrentPath()).toBe('/game/bubbleWrap');
    });

    it('locks history when popstate fires with query and hash: "#/settings?key=secret#deep"', async () => {
      const gameHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/settings', settingsHandler);

      await router.navigate('/game/bubbleWrap');

      let interceptedTo = '';
      router.beforeEach((to) => {
        interceptedTo = to;
        return false;
      });

      window.history.pushState({}, '', '#/settings?key=secret#deep');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(interceptedTo).toBe('/settings');
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/game/bubbleWrap');
    });

    it('navigates cleanly on popstate when guard confirms access', async () => {
      const gameHandler = vi.fn();
      const settingsHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/settings', settingsHandler);

      await router.navigate('/game/bubbleWrap');

      router.beforeEach((to) => {
        if (to === '/settings') {
          return true; // Parent approves
        }
        return false;
      });

      window.history.pushState({}, '', '#/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/settings');
      expect(router.getCurrentPath()).toBe('/settings');
    });

    it('redirects on popstate when guard returns a string path', async () => {
      const gameHandler = vi.fn();
      const settingsHandler = vi.fn();
      const hubHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/settings', settingsHandler);
      router.addRoute('/', hubHandler);

      await router.navigate('/game/bubbleWrap');

      router.beforeEach((to) => {
        if (to === '/settings') {
          return '/'; // Redirect to hub
        }
        return true;
      });

      window.history.pushState({}, '', '#/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(settingsHandler).not.toHaveBeenCalled();
      expect(hubHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/');
      expect(router.getCurrentPath()).toBe('/');
    });
  });

  describe('Vector 4: Concurrent & Race Condition Attacks', () => {
    it('rejects concurrent navigate() while another navigation guard is evaluating', async () => {
      const settingsHandler = vi.fn();
      const gameHandler = vi.fn();

      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);
      router.addRoute('/game/bubbleWrap', gameHandler);
      router.init();

      let resolveGuard: ((allowed: boolean) => void) | null = null;
      router.beforeEach((to) => {
        if (to === '/settings') {
          return new Promise<boolean>((resolve) => {
            resolveGuard = resolve;
          });
        }
        return true;
      });

      // Start first navigation to /settings
      const firstNavPromise = router.navigate('/settings');

      // Attempt second navigation while first is still awaiting guard
      const secondNavResult = router.navigate('/game/bubbleWrap');

      // Second navigation must be rejected synchronously (returns false)
      expect(secondNavResult).toBe(false);
      expect(gameHandler).not.toHaveBeenCalled();

      // Resolve first guard with false (cancelled)
      resolveGuard!(false);
      const firstAllowed = await firstNavPromise;

      expect(firstAllowed).toBe(false);
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(router.getCurrentPath()).toBe('/');
    });

    it('handles popstate dispatched while an async navigation guard is evaluating', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/settings', settingsHandler);
      router.addRoute('/game/bubbleWrap', vi.fn());

      await router.navigate('/game/bubbleWrap');

      let resolveGuard: ((allowed: boolean) => void) | null = null;
      router.beforeEach((to) => {
        if (to === '/settings') {
          return new Promise<boolean>((resolve) => {
            resolveGuard = resolve;
          });
        }
        return true;
      });

      // Start async navigation to /settings
      const navPromise = router.navigate('/settings');

      // Popstate arrives while isNavigating is true
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));

      // Resolve original navigation with false
      resolveGuard!(false);
      await navPromise;

      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/game/bubbleWrap');
    });
  });

  describe('Vector 5: Real-World main.ts Route Shielding Integration', () => {
    it('applies main.ts guard logic against all adversarial formats and activates ParentalGate', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);

      // Exact guard logic from src/main.ts:241-249
      router.beforeEach(async (to) => {
        const normalizedTo = router.normalizePath(to);
        if (normalizedTo === '/settings' || normalizedTo.startsWith('/settings')) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false)
            );
          });
        }
        return true;
      });

      const attackFormats = [
        '#/settings',
        '///settings///',
        '#/settings?token=steal',
        '#settings',
        '#/settings/billing',
        '///settings?test=1#nested',
      ];

      for (const attackPath of attackFormats) {
        // Toddler attempts attack path
        const navPromise = router.navigate(attackPath);

        // ParentalGate overlay MUST mount
        const overlay = document.getElementById('parental-gate-overlay');
        expect(overlay).not.toBeNull();
        expect(settingsHandler).not.toHaveBeenCalled();

        // Toddler cancels ParentalGate
        const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
        expect(closeBtn).not.toBeNull();
        closeBtn.click();

        const result = await navPromise;
        expect(result).toBe(false);
        expect(settingsHandler).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/');
        expect(document.getElementById('parental-gate-overlay')).toBeNull();
      }
    });

    it('authorizes entry to /settings when parent solves ParentalGate challenge on cold boot', async () => {
      window.history.replaceState({}, '', '/#/settings');
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        const normalizedTo = router.normalizePath(to);
        if (normalizedTo === '/settings' || normalizedTo.startsWith('/settings')) {
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
      expect(router.getCurrentPath()).toBe('/settings');
    });
  });

  describe('Vector 6: Error Resilience & Guard Pipeline Integrity', () => {
    it('recovers cleanly when a guard throws an exception and does not deadlock future navigations', async () => {
      const homeHandler = vi.fn();
      const settingsHandler = vi.fn();
      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);
      router.init();

      let shouldThrow = true;
      router.beforeEach(() => {
        if (shouldThrow) {
          throw new Error('Exploding guard');
        }
        return true;
      });

      // Navigation throws
      await expect(router.navigate('/settings')).rejects.toThrow('Exploding guard');
      expect(settingsHandler).not.toHaveBeenCalled();

      // Ensure router is NOT deadlocked by isNavigating flag
      shouldThrow = false;
      const secondAttempt = await router.navigate('/settings');
      expect(secondAttempt).toBe(true);
      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(router.getCurrentPath()).toBe('/settings');
    });

    it('short-circuits guard pipeline upon first rejection in multi-guard sequence', async () => {
      const g1 = vi.fn().mockReturnValue(true);
      const g2 = vi.fn().mockReturnValue(false);
      const g3 = vi.fn().mockReturnValue(true);
      const targetHandler = vi.fn();

      router.addRoute('/', vi.fn());
      router.addRoute('/protected', targetHandler);
      router.init();

      router.beforeEach(g1);
      router.beforeEach(g2);
      router.beforeEach(g3);

      const allowed = await router.navigate('/protected');

      expect(allowed).toBe(false);
      expect(g1).toHaveBeenCalledTimes(1);
      expect(g2).toHaveBeenCalledTimes(1);
      expect(g3).not.toHaveBeenCalled(); // Short-circuited!
      expect(targetHandler).not.toHaveBeenCalled();
    });

    it('safely handles falsy, null, undefined, and empty string navigations by resolving to root', async () => {
      const homeHandler = vi.fn();
      router.addRoute('/', homeHandler);
      router.init();

      expect(homeHandler).toHaveBeenCalledTimes(1);

      await router.navigate('');
      expect(router.getCurrentPath()).toBe('/');

      await router.navigate(null as unknown as string);
      expect(router.getCurrentPath()).toBe('/');

      await router.navigate(undefined as unknown as string);
      expect(router.getCurrentPath()).toBe('/');

      await router.navigate('    ');
      expect(router.getCurrentPath()).toBe('/');
    });
  });

  describe('Vector 7: Active Game Session Safe Exit Flow Penetration', () => {
    it('shields active game session against exit attempts with hash variants', async () => {
      const gameHandler = vi.fn();
      const sandboxHandler = vi.fn();
      const homeHandler = vi.fn();

      router.addRoute('/game/bubbleWrap', gameHandler);
      router.addRoute('/portal/sandbox', sandboxHandler);
      router.addRoute('/', homeHandler);

      // Start in game session
      await router.navigate('/game/bubbleWrap');
      expect(router.getCurrentPath()).toBe('/game/bubbleWrap');

      // Exact game exit guard logic from src/main.ts:217-238
      router.beforeEach(async (to, from) => {
        if (from && from.startsWith('/game/') && to !== from) {
          return new Promise<boolean>((resolve) => {
            ParentalGate.getInstance().verify(
              () => resolve(true),
              () => resolve(false)
            );
          });
        }
        return true;
      });

      const exitVariants = [
        '#/',
        '///',
        '#/portal/sandbox',
        '#/game/colorMixer',
        '///portal/sandbox///',
      ];

      for (const exitPath of exitVariants) {
        const exitPromise = router.navigate(exitPath);

        // Parental gate must trigger
        const overlay = document.getElementById('parental-gate-overlay');
        expect(overlay).not.toBeNull();

        // Dismiss gate (toddler cancel)
        const closeBtn = document.querySelector('.parental-gate-close-btn') as HTMLButtonElement;
        closeBtn.click();

        const allowed = await exitPromise;
        expect(allowed).toBe(false);
        expect(router.getCurrentPath()).toBe('/game/bubbleWrap');
        expect(window.location.pathname).toBe('/game/bubbleWrap');
      }

      // Re-navigating to the same game session (#/game/bubbleWrap) must NOT trigger gate
      const sameGameNav = await router.navigate('#/game/bubbleWrap');
      expect(sameGameNav).toBe(true);
      expect(document.getElementById('parental-gate-overlay')).toBeNull();
      expect(router.getCurrentPath()).toBe('/game/bubbleWrap');
    });
  });
});

