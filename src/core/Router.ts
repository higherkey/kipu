export type RouteHandler = (params?: Record<string, string>) => void;
export type RouteGuardResult = boolean | string;
export type RouteGuard = (
  to: string,
  from: string | null
) => RouteGuardResult | Promise<RouteGuardResult>;

/**
 * Client-side router for Kipu.
 * Handles URL navigation using the History API with navigation guard middleware.
 */
export class Router {
  private readonly routes: Map<string, RouteHandler> = new Map();
  private readonly guards: RouteGuard[] = [];
  private currentPath: string | null = null;
  private isNavigating: boolean = false;

  private readonly boundPopState = async () => {
    let rawTo = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.startsWith('#/') || !rawTo || rawTo === '/') {
        rawTo = window.location.hash;
      }
    }
    const to = this.normalizePath(rawTo);
    const from = this.currentPath ? this.normalizePath(this.currentPath) : null;

    if (this.isNavigating) {
      if (from) {
        window.history.pushState({}, '', from);
      }
      return;
    }

    if (this.guards.length === 0 || !from || to === from) {
      this.executeRoute(to);
      return;
    }

    // History Lock: Revert URL to current path immediately
    window.history.pushState({}, '', from);

    const allowed = await this.runGuards(to, from);
    if (allowed === true) {
      window.history.replaceState({}, '', to);
      this.executeRoute(to);
    } else if (typeof allowed === 'string') {
      this.navigate(allowed);
    }
    // If allowed is false, history is already at from, preserving active game session
  };

  private readonly boundDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');

    if (
      link &&
      link instanceof HTMLAnchorElement &&
      link.origin === window.location.origin &&
      !link.hasAttribute('download') &&
      link.target !== '_blank'
    ) {
      e.preventDefault();
      const href = link.getAttribute('href') || link.pathname;
      this.navigate(href);
    }
  };

  constructor() {
    window.addEventListener('popstate', this.boundPopState);
    document.addEventListener('click', this.boundDocumentClick);
  }

  /**
   * Destroys router instance and cleans up window and document listeners.
   */
  public destroy(): void {
    window.removeEventListener('popstate', this.boundPopState);
    document.removeEventListener('click', this.boundDocumentClick);
  }

  /**
   * Registers a navigation guard middleware called before route changes.
   */
  public beforeEach(guard: RouteGuard): () => void {
    this.guards.push(guard);
    return () => {
      const index = this.guards.indexOf(guard);
      if (index !== -1) this.guards.splice(index, 1);
    };
  }

  /**
   * Returns the current active path, if initialized.
   */
  public getCurrentPath(): string | null {
    return this.currentPath;
  }

  /**
   * Registers a handler for a specific path.
   * Supports exact matches and dynamic routes like '/game/:id' and '/portal/:portalId'.
   */
  public addRoute(path: string, handler: RouteHandler): void {
    this.routes.set(this.normalizePath(path), handler);
  }

  /**
   * Navigates to a new path.
   * @param path The URL path to navigate to.
   * @param pushState Whether to add a new entry to the browser history.
   */
  public navigate(path: string, pushState: boolean = true): boolean | Promise<boolean> {
    // Normalize path before guards so guard comparisons always see clean strings
    const to = this.normalizePath(path);
    const from = this.currentPath
      ? this.normalizePath(this.currentPath)
      : (typeof window !== 'undefined' ? this.normalizePath(window.location.pathname) : '/');

    if (this.isNavigating) {
      return false;
    }

    // Fast-path: 100% synchronous when no guards are registered (maintains test suite speed)
    if (this.guards.length === 0) {
      if (pushState) {
        window.history.pushState({}, '', to);
      }
      this.executeRoute(to);
      return true;
    }

    return this.navigateWithGuards(to, from, pushState);
  }

  private async navigateWithGuards(to: string, from: string | null, pushState: boolean): Promise<boolean> {
    const allowed = await this.runGuards(to, from);
    if (allowed === false) {
      return false;
    }

    if (typeof allowed === 'string') {
      const redirected = await this.navigate(allowed, pushState);
      return Boolean(redirected);
    }

    if (pushState) {
      window.history.pushState({}, '', to);
    }
    this.executeRoute(to);
    return true;
  }

  private async runGuards(to: string, from: string | null): Promise<RouteGuardResult> {
    this.isNavigating = true;
    try {
      for (const guard of this.guards) {
        const result = await guard(to, from);
        if (result === false || typeof result === 'string') {
          return result;
        }
      }
      return true;
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Normalizes any input route path into canonical form:
   * - Strips leading '#'
   * - Strips query strings (?...) and secondary fragments (#...)
   * - Ensures single leading '/'
   * - Strips trailing '/' (unless root '/')
   * - Preserves wildcard token '*'
   * - Falls back to '/' for empty/falsy input
   */
  public normalizePath(rawPath?: string | null): string {
    if (!rawPath) {
      return '/';
    }

    let path = rawPath.trim();
    if (path === '*') {
      return '*';
    }

    if (path.startsWith('#')) {
      path = path.substring(1);
    }

    // Strip query strings and secondary fragments
    path = path.split('?')[0].split('#')[0];

    if (!path) {
      return '/';
    }

    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    path = path.replace(/^\/+/, '/');

    if (path.length > 1 && path.endsWith('/')) {
      path = path.replace(/\/+$/, '') || '/';
    }

    return path;
  }

  /**
   * Initializes the router and handles the current URL.
   * If guards are registered, evaluates guards on the initial route.
   * If guards reject, redirects to root ('/').
   */
  public init(): void | Promise<void> {
    let rawInitial = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.startsWith('#/') || !rawInitial || rawInitial === '/') {
        rawInitial = window.location.hash;
      }
    }
    const initialPath = this.normalizePath(rawInitial || '/');

    if (this.guards.length === 0 || initialPath === '/') {
      this.executeRoute(initialPath);
      return;
    }

    return (async () => {
      const allowed = await this.runGuards(initialPath, null);
      if (allowed === false) {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/');
        }
        this.executeRoute('/');
        return;
      }

      if (typeof allowed === 'string') {
        const redirected = this.normalizePath(allowed);
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', redirected);
        }
        this.executeRoute(redirected);
        return;
      }

      this.executeRoute(initialPath);
    })();
  }

  private executeRoute(rawPath: string): void {
    const cleanPath = this.normalizePath(rawPath);
    this.currentPath = cleanPath;

    const matched = this.matchRoute(cleanPath);
    if (matched) {
      matched.handler(matched.params);
      return;
    }

    // Default: Fallback to Not Found if no match
    const notFoundHandler = this.routes.get('*');
    if (notFoundHandler) {
      notFoundHandler();
      return;
    }

    // Ultimate fallback to root
    const rootHandler = this.routes.get('/');
    if (rootHandler) {
      if (cleanPath !== '/') {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/');
        }
        this.currentPath = '/';
      }
      rootHandler();
    }
  }

  private matchRoute(path: string): { handler: RouteHandler; params?: Record<string, string> } | null {
    // Exact match
    const exactHandler = this.routes.get(path);
    if (exactHandler) {
      return { handler: exactHandler };
    }

    // Dynamic game route: /game/[id]
    if (path.startsWith('/game/')) {
      const gameId = path.substring(6);
      const handler = gameId ? this.routes.get('/game/:id') : null;
      if (handler) {
        return { handler, params: { id: gameId } };
      }
    }

    // Dynamic portal route: /portal/[id]
    if (path.startsWith('/portal/')) {
      const portalId = path.substring(8);
      const handler = portalId ? this.routes.get('/portal/:portalId') : null;
      if (handler) {
        return { handler, params: { portalId } };
      }
    }

    return null;
  }
}
