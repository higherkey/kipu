import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../src/core/Router';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    // Reset path
    window.history.replaceState({}, '', '/');
    router = new Router();
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
});
