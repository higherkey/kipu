interface Route {
  path: string;
  handler: (params?: Record<string, string>) => void;
}

export class Router {
  private readonly routes: Route[] = [];

  public addRoute(path: string, handler: (params?: Record<string, string>) => void): void {
    this.routes.push({ path, handler });
  }

  public navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.handleRoute(path);
  }

  public init(): void {
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    window.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return;
      }

      const anchor = this.findParentAnchor(e.target as HTMLElement | null);
      if (anchor && this.shouldIntercept(anchor)) {
        e.preventDefault();
        this.navigate(anchor.pathname);
      }
    });

    this.handleRoute(window.location.pathname);
  }

  private findParentAnchor(element: HTMLElement | null): HTMLAnchorElement | null {
    let target = element;
    while (target && target !== document.body) {
      if (target.tagName === 'A') {
        return target as HTMLAnchorElement;
      }
      target = target.parentElement;
    }
    return null;
  }

  private shouldIntercept(anchor: HTMLAnchorElement): boolean {
    const targetAttr = anchor.getAttribute('target');
    if (targetAttr && targetAttr !== '_self') {
      return false;
    }

    const href = anchor.getAttribute('href');
    if (!href) {
      return false;
    }

    const isRelative = href.startsWith('/') && !href.startsWith('//');
    const isSameOrigin = href.startsWith(window.location.origin);
    return isRelative || isSameOrigin;
  }

  private handleRoute(requestPath: string): void {
    for (const route of this.routes) {
      if (route.path === '*') continue;
      
      const params = this.matchRoute(route.path, requestPath);
      if (params) {
        route.handler(params);
        return;
      }
    }

    const wildcardRoute = this.routes.find(route => route.path === '*');
    if (wildcardRoute) {
      wildcardRoute.handler();
    }
  }

  private matchRoute(routePath: string, requestPath: string): Record<string, string> | null {
    const routeSegments = routePath.split('/').filter(Boolean);
    const requestSegments = requestPath.split('/').filter(Boolean);

    if (routeSegments.length !== requestSegments.length) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSeg = routeSegments[i];
      const reqSeg = requestSegments[i];

      if (routeSeg.startsWith(':')) {
        const paramName = routeSeg.slice(1);
        params[paramName] = decodeURIComponent(reqSeg);
      } else if (routeSeg.toLowerCase() !== reqSeg.toLowerCase()) {
        return null;
      }
    }

    return params;
  }
}
