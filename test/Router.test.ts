import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../src/core/Router';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    // Reset path
    window.history.replaceState({}, '', '/');
    router = new Router();
  });

  afterEach(() => {
    router.destroy();
  });

  it('should register and trigger exact routes', () => {
    const handler = vi.fn();
    router.addRoute('/', handler);
    router.init();

    expect(handler).toHaveBeenCalled();
  });

  it('should parse dynamic route parameters', () => {
    const handler = vi.fn();
    router.addRoute('/game/:id', handler);
    
    router.navigate('/game/bubbleWrap');

    expect(handler).toHaveBeenCalledWith({ id: 'bubbleWrap' });
  });

  it('should parse dynamic portal route parameters', () => {
    const handler = vi.fn();
    router.addRoute('/portal/:portalId', handler);
    
    router.navigate('/portal/sandbox');

    expect(handler).toHaveBeenCalledWith({ portalId: 'sandbox' });
  });

  it('should fall back to wildcard route if no matches found', () => {
    const exactHandler = vi.fn();
    const wildHandler = vi.fn();

    router.addRoute('/', exactHandler);
    router.addRoute('*', wildHandler);
    
    router.navigate('/some/invalid/path');

    expect(exactHandler).not.toHaveBeenCalled();
    expect(wildHandler).toHaveBeenCalled();
  });

  it('should navigate and change window history', () => {
    const handler = vi.fn();
    router.addRoute('/test', handler);

    router.navigate('/test');

    expect(window.location.pathname).toBe('/test');
    expect(handler).toHaveBeenCalled();
  });

  it('should intercept anchor tag clicks', () => {
    const handler = vi.fn();
    router.addRoute('/about', handler);
    router.init();

    // Create mock link
    const link = document.createElement('a');
    link.href = '/about';
    document.body.appendChild(link);

    // Trigger click event
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/about');
    expect(handler).toHaveBeenCalled();

    link.remove();
  });

  describe('normalizePath() helper', () => {
    it('normalizes empty, null, and undefined paths to root /', () => {
      expect(router.normalizePath('')).toBe('/');
      expect(router.normalizePath(null)).toBe('/');
      expect(router.normalizePath(undefined)).toBe('/');
      expect(router.normalizePath('   ')).toBe('/');
    });

    it('normalizes hash prefixes (#/settings, #settings, #/)', () => {
      expect(router.normalizePath('#/settings')).toBe('/settings');
      expect(router.normalizePath('#settings')).toBe('/settings');
      expect(router.normalizePath('#/')).toBe('/');
      expect(router.normalizePath('#')).toBe('/');
    });

    it('strips query parameters and secondary hash fragments', () => {
      expect(router.normalizePath('/settings?mode=dark')).toBe('/settings');
      expect(router.normalizePath('#/settings?tab=general#subtab')).toBe('/settings');
      expect(router.normalizePath('#/game/khipuSynth#pattern=loop1')).toBe('/game/khipuSynth');
    });

    it('strips trailing slashes while preserving root /', () => {
      expect(router.normalizePath('/settings/')).toBe('/settings');
      expect(router.normalizePath('#/portal/sandbox/')).toBe('/portal/sandbox');
      expect(router.normalizePath('///')).toBe('/');
      expect(router.normalizePath('/')).toBe('/');
    });

    it('ensures leading slash for relative paths', () => {
      expect(router.normalizePath('settings')).toBe('/settings');
      expect(router.normalizePath('game/bubbleWrap')).toBe('/game/bubbleWrap');
    });

    it('preserves wildcard * route token', () => {
      expect(router.normalizePath('*')).toBe('*');
    });
  });

  describe('Navigation Guards & Path Normalization', () => {
    it('normalizes hash route paths prior to executing beforeEach navigation guards', async () => {
      let guardToPath = '';
      let guardFromPath: string | null = '';
      const settingsHandler = vi.fn();

      router.addRoute('/settings', settingsHandler);
      router.beforeEach(async (to, from) => {
        guardToPath = to;
        guardFromPath = from;
        return true;
      });

      await router.navigate('#/settings');

      expect(guardToPath).toBe('/settings');
      expect(guardFromPath).toBe('/');
      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/settings');
    });

    it('blocks navigation when guard rejects a hash route path', async () => {
      const settingsHandler = vi.fn();
      router.addRoute('/', vi.fn());
      router.addRoute('/settings', settingsHandler);

      router.beforeEach((to) => {
        if (to === '/settings') {
          return false;
        }
        return true;
      });

      const allowed = await router.navigate('#/settings');

      expect(allowed).toBe(false);
      expect(settingsHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');
    });

    it('executes beforeEach guards during init() and redirects to root when guard returns false', async () => {
      window.history.replaceState({}, '', '/settings');
      const settingsHandler = vi.fn();
      const homeHandler = vi.fn();

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

    it('executes beforeEach guards during init() and proceeds when guard returns true', async () => {
      window.history.replaceState({}, '', '/settings');
      const settingsHandler = vi.fn();
      const homeHandler = vi.fn();

      router.addRoute('/', homeHandler);
      router.addRoute('/settings', settingsHandler);

      router.beforeEach(async (to) => {
        if (to === '/settings') {
          return true;
        }
        return false;
      });

      await router.init();

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      expect(homeHandler).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings');
    });
  });
});
