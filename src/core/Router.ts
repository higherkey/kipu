export type RouteHandler = (params?: Record<string, string>) => void;

/**
 * Simple client-side router for Kipu.
 * Handles URL navigation using the History API.
 */
export class Router {
  private routes: Map<string, RouteHandler> = new Map();

  constructor() {
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Intercept internal link clicks
    document.addEventListener('click', (e: MouseEvent) => {
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
        this.navigate(link.pathname);
      }
    });
  }

  /**
   * Registers a handler for a specific path.
   * Supports exact matches and a special '/game/:id' pattern.
   */
  public addRoute(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  /**
   * Navigates to a new path.
   * @param path The URL path to navigate to.
   * @param pushState Whether to add a new entry to the browser history.
   */
  public navigate(path: string, pushState: boolean = true): void {
    if (pushState) {
      window.history.pushState({}, '', path);
    }
    this.handleRoute(path);
  }

  /**
   * Initializes the router and handles the current URL.
   */
  public init(): void {
    this.handleRoute(window.location.pathname);
  }

  private handleRoute(path: string): void {
    // Exact match
    if (this.routes.has(path)) {
      const handler = this.routes.get(path);
      if (handler) {
        handler();
        return;
      }
    }

    // Dynamic game route: /game/[id]
    if (path.startsWith('/game/')) {
      const gameId = path.substring(6); // Remove '/game/'
      if (gameId) {
        const handler = this.routes.get('/game/:id');
        if (handler) {
          handler({ id: gameId });
          return;
        }
      }
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
      if (path !== '/') {
        window.history.replaceState({}, '', '/');
      }
      rootHandler();
    }
  }
}
