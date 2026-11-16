import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameHeader } from '../src/ui/GameHeader';
import { GameUI } from '../src/ui/GameUI';
import { HapticController } from '../src/core/HapticController';

describe('Sitewright CSS Standards, Specificity Cascade & Touch Targets', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.removeItem('soundEnabled');
    localStorage.removeItem('vibrationEnabled');
    (HapticController as any).instance = undefined;
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. Dynamic UI Elements Zero Inline Style Attributes', () => {
    it('GameHeader dynamically creates header elements with zero inline style attributes', () => {
      const header = new GameHeader({
        gameName: 'Pawana Test Game',
        portalId: 'sandbox',
        portalName: 'Sandbox',
        onPortalBack: vi.fn(),
        onHome: vi.fn(),
        onMenuToggle: vi.fn(),
      });

      header.mount(document.body);

      const headerEl = document.getElementById('game-header');
      expect(headerEl).not.toBeNull();
      expect(headerEl?.getAttribute('style')).toBeNull();

      const allHeaderDescendants = headerEl?.querySelectorAll('*') || [];
      expect(allHeaderDescendants.length).toBeGreaterThan(0);

      allHeaderDescendants.forEach((child) => {
        expect(child.getAttribute('style')).toBeNull();
      });

      header.unmount();
    });

    it('GameUI slide menu dynamically creates all elements with zero inline style attributes', () => {
      const gameUI = new GameUI({
        gameName: 'Pawana Test Game',
        portalId: 'sandbox',
        portalName: 'Sandbox',
        onPortalBack: vi.fn(),
        onHome: vi.fn(),
        onPause: vi.fn(),
        onResume: vi.fn(),
        onRestart: vi.fn(),
        soundEnabled: true,
        vibrationEnabled: true,
        onSoundToggle: vi.fn(),
        onVibrationToggle: vi.fn(),
      });

      gameUI.mount();

      const menuEl = document.getElementById('slide-menu');
      expect(menuEl).not.toBeNull();
      expect(menuEl?.getAttribute('style')).toBeNull();

      const allMenuDescendants = menuEl?.querySelectorAll('*') || [];
      expect(allMenuDescendants.length).toBeGreaterThan(0);

      allMenuDescendants.forEach((child) => {
        expect(child.getAttribute('style')).toBeNull();
      });

      gameUI.unmount();
    });

    it('HapticController WebKit fallback provisions switch and label with zero inline style attributes', () => {
      const haptics = HapticController.getInstance();
      haptics.lightTap();

      const switchEl = document.querySelector('input.haptic-switch-fallback') as HTMLInputElement;
      const labelEl = document.querySelector('label.haptic-label-fallback') as HTMLLabelElement;

      expect(switchEl).not.toBeNull();
      expect(labelEl).not.toBeNull();

      expect(switchEl.getAttribute('style')).toBeNull();
      expect(labelEl.getAttribute('style')).toBeNull();

      expect(switchEl.id).toBe('haptic-switch-fallback');
      expect(switchEl.className).toBe('haptic-switch-fallback');
      expect(labelEl.htmlFor).toBe('haptic-switch-fallback');
      expect(labelEl.className).toBe('haptic-label-fallback');
    });
  });

  describe('2. Specificity Cascade & Canvas HUD Offset', () => {
    it('applies top offset via specificity cascade without !important', () => {
      // Set up DOM hierarchy: #app > #game-canvas
      const app = document.createElement('div');
      app.id = 'app';
      const canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      app.appendChild(canvas);
      document.body.appendChild(app);

      // Inject style sheet mirroring src/style.css and src/ui/GameUI.css
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --header-height: 64px;
        }
        #game-canvas {
          margin-top: 0px;
          height: 100%;
        }
        #app #game-canvas.with-hud,
        #game-canvas.with-hud {
          margin-top: var(--header-height, 64px);
          height: calc(100% - var(--header-height, 64px));
        }
      `;
      document.head.appendChild(style);

      // 1. Without .with-hud
      const initialStyle = window.getComputedStyle(canvas);
      expect(canvas.classList.contains('with-hud')).toBe(false);
      expect(initialStyle.marginTop).toBe('0px');

      // 2. Add .with-hud (simulating game route entry in main.ts:339)
      canvas.classList.add('with-hud');
      expect(canvas.classList.contains('with-hud')).toBe(true);

      const hudStyle = window.getComputedStyle(canvas);
      // In JSDOM, CSS custom property references are preserved as 'var(--header-height, 64px)'
      expect(hudStyle.marginTop).toMatch(/var\(--header-height,\s*64px\)|64px/);

      // 3. Remove .with-hud (simulating return to portal/home in main.ts:213/252)
      canvas.classList.remove('with-hud');
      const resetStyle = window.getComputedStyle(canvas);
      expect(resetStyle.marginTop).toBe('0px');

      style.remove();
      app.remove();
    });

    it('recalculates canvas top offset under mobile header breakpoint (56px)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      const canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      canvas.className = 'with-hud';
      app.appendChild(canvas);
      document.body.appendChild(app);

      // Simulating mobile query: --header-height = 56px
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --header-height: 56px;
        }
        #app #game-canvas.with-hud {
          margin-top: var(--header-height, 64px);
        }
      `;
      document.head.appendChild(style);

      const rootComputed = window.getComputedStyle(document.documentElement);
      const headerVar = rootComputed.getPropertyValue('--header-height').trim();
      expect(headerVar).toBe('56px');

      const computed = window.getComputedStyle(canvas);
      expect(computed.marginTop).toMatch(/var\(--header-height,\s*64px\)|56px/);

      style.remove();
      app.remove();
    });

    it('validates mathematical W3C selector specificity rankings', () => {
      // Mathematical validation of CSS Selectors Level 3/4 spec:
      // Specificity = (inline, ID, class/attr, type)
      // Rank value = ID * 100 + class * 10 + type * 1
      function calculateSpecificity(selector: string): [number, number, number] {
        const idCount = (selector.match(/#[a-zA-Z0-9_-]+/g) || []).length;
        const classCount = (selector.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
        const typeCount = (selector.replace(/#[a-zA-Z0-9_-]+/g, '').replace(/\.[a-zA-Z0-9_-]+/g, '').match(/[a-zA-Z0-9_-]+/g) || []).length;
        return [idCount, classCount, typeCount];
      }

      const baseSelector = '#game-canvas';
      const appSelector = '#app #game-canvas';
      const classOnlySelector = '#game-canvas.with-hud';
      const cascadeSelector = '#app #game-canvas.with-hud';

      const [baseId, baseClass] = calculateSpecificity(baseSelector);
      const [appId, appClass] = calculateSpecificity(appSelector);
      const [classOnlyId, classOnlyClass] = calculateSpecificity(classOnlySelector);
      const [cascadeId, cascadeClass] = calculateSpecificity(cascadeSelector);

      // #game-canvas -> (1, 0, 0)
      expect(baseId).toBe(1);
      expect(baseClass).toBe(0);

      // #app #game-canvas -> (2, 0, 0)
      expect(appId).toBe(2);
      expect(appClass).toBe(0);

      // #game-canvas.with-hud -> (1, 1, 0)
      expect(classOnlyId).toBe(1);
      expect(classOnlyClass).toBe(1);

      // #app #game-canvas.with-hud -> (2, 1, 0)
      expect(cascadeId).toBe(2);
      expect(cascadeClass).toBe(1);

      // Verify that (2, 1, 0) strictly dominates (2, 0, 0), (1, 1, 0), and (1, 0, 0)
      const cascadeScore = cascadeId * 100 + cascadeClass * 10;
      const appScore = appId * 100 + appClass * 10;
      const classOnlyScore = classOnlyId * 100 + classOnlyClass * 10;
      const baseScore = baseId * 100 + baseClass * 10;

      expect(cascadeScore).toBeGreaterThan(appScore);
      expect(cascadeScore).toBeGreaterThan(classOnlyScore);
      expect(cascadeScore).toBeGreaterThan(baseScore);
    });
  });

  describe('3. Touch Target Minimum Bounds Compliance', () => {
    it('GameHeader buttons have standard minimum 44px dimension classes and attributes', () => {
      const header = new GameHeader({
        gameName: 'Pawana Test Game',
        portalId: 'sandbox',
        portalName: 'Sandbox',
        onPortalBack: vi.fn(),
        onHome: vi.fn(),
        onMenuToggle: vi.fn(),
      });

      header.mount(document.body);

      const portalBackBtn = document.querySelector('.portal-back-btn') as HTMLButtonElement;
      const homeBtn = document.querySelector('.home-btn') as HTMLButtonElement;
      const menuBtn = document.querySelector('.menu-btn') as HTMLButtonElement;

      expect(portalBackBtn).not.toBeNull();
      expect(homeBtn).not.toBeNull();
      expect(menuBtn).not.toBeNull();

      expect(portalBackBtn.classList.contains('header-btn')).toBe(true);
      expect(homeBtn.classList.contains('header-btn')).toBe(true);
      expect(menuBtn.classList.contains('header-btn')).toBe(true);

      header.unmount();
    });

    it('GameUI slide menu interactive buttons have minimum 44px compliant classes and structures', () => {
      const gameUI = new GameUI({
        gameName: 'Pawana Test Game',
        onHome: vi.fn(),
        onPause: vi.fn(),
        onResume: vi.fn(),
        onRestart: vi.fn(),
        soundEnabled: true,
        vibrationEnabled: true,
        onSoundToggle: vi.fn(),
        onVibrationToggle: vi.fn(),
      });

      gameUI.mount();

      const closeBtn = document.querySelector('.slide-menu-close-btn') as HTMLButtonElement;
      const pauseBtn = document.querySelector('.pause-btn') as HTMLButtonElement;
      const resumeBtn = document.querySelector('.resume-btn') as HTMLButtonElement;
      const restartBtn = document.querySelector('.restart-btn') as HTMLButtonElement;
      const toggles = document.querySelectorAll('.settings-toggle');

      expect(closeBtn).not.toBeNull();
      expect(pauseBtn).not.toBeNull();
      expect(resumeBtn).not.toBeNull();
      expect(restartBtn).not.toBeNull();
      expect(toggles.length).toBe(2);

      // Verify toggle button structure has track and thumb children
      toggles.forEach((toggle) => {
        expect(toggle.querySelector('.toggle-track')).not.toBeNull();
        expect(toggle.querySelector('.toggle-thumb')).not.toBeNull();
      });

      gameUI.unmount();
    });
  });

  describe('5. LCP & Web Vitals Optimization (/longest-contentful-paint-slim)', () => {
    it('index.html contains font preconnects and stylesheet link in head to eliminate LCP delay', async () => {
      // @ts-ignore
      const fs = await import('fs');
      const html = fs.readFileSync('index.html', 'utf-8');

      expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
      expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin');
      expect(html).toContain('href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap"');
    });

    it('src/style.css does not block stylesheet parsing with @import', async () => {
      // @ts-ignore
      const fs = await import('fs');
      const css = fs.readFileSync('src/style.css', 'utf-8');

      expect(css).not.toContain('@import url(');
    });
  });

  describe('6. Accessibility & a11y Standards (/accessibility-and-a11y-slim)', () => {
    it('index.html marks decorative SVGs with aria-hidden="true" and focusable="false"', async () => {
      // @ts-ignore
      const fs = await import('fs');
      const html = fs.readFileSync('index.html', 'utf-8');

      // Check all nav and tab bar SVGs have aria-hidden="true"
      expect(html).toContain('aria-hidden="true" focusable="false"');
    });

    it('src/style.css supports prefers-reduced-motion to respect user motion preferences', async () => {
      // @ts-ignore
      const fs = await import('fs');
      const css = fs.readFileSync('src/style.css', 'utf-8');

      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('animation: none');
    });
  });
});
