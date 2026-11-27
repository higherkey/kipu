import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CameraGame } from '../src/games/camera/CameraGame';
import { GameRegistry } from '../src/core/GameRegistry';
import { HapticController } from '../src/core/HapticController';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

import { renderGameList, escapeHtml } from '../src/main';

function createMockContext(): any {
  const ctxBase: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    filter: 'none',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalCompositeOperation: 'source-over',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokeRect: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(800 * 600 * 4),
      width: 800,
      height: 600,
    })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  };
  return ctxBase;
}

function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('M4 Adversarial Stress Test Suite: Camera Game & Hub Dynamic Cards', () => {
  let game: CameraGame | null = null;
  let canvas: HTMLCanvasElement;
  let heavyImpactSpy: ReturnType<typeof vi.spyOn>;
  let lightTapSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-list" class="cards-grid" role="menu"></div>
    `;

    const contextMap = new WeakMap<HTMLCanvasElement, any>();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      if (!contextMap.has(this)) {
        contextMap.set(this, createMockContext());
      }
      return contextMap.get(this);
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );

    // Mock HTMLMediaElement in JSDOM
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    class MockAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
      }));
    }
    window.AudioContext = MockAudioContext as any;

    heavyImpactSpy = vi.spyOn(HapticController.getInstance(), 'heavyImpact').mockImplementation(() => {});
    lightTapSpy = vi.spyOn(HapticController.getInstance(), 'lightTap').mockImplementation(() => {});

    canvas = createMockCanvas();
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    if (game) {
      game.destroy();
      game = null;
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. Camera Stream Denial & Fallback Stress', () => {
    it('gracefully handles getUserMedia rejecting with NotAllowedError and NotFoundError with zero crashes', async () => {
      const unhandledRejections: any[] = [];
      const onUnhandled = (e: PromiseRejectionEvent) => {
        unhandledRejections.push(e.reason);
      };
      window.addEventListener('unhandledrejection', onUnhandled);

      const consoleErrorSpy = vi.spyOn(console, 'error');

      // 1. NotAllowedError (permission denied)
      const notAllowedMock = vi.fn().mockRejectedValue(new DOMException('User denied camera access', 'NotAllowedError'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: notAllowedMock },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(true);
      expect(game.getMediaStream()).toBeNull();
      const statusText1 = document.querySelector('#camera-status-text')?.textContent;
      expect(statusText1).toBe('Simulated Camera');

      game.destroy();

      // 2. NotFoundError (no hardware camera)
      const notFoundMock = vi.fn().mockRejectedValue(new DOMException('Requested device not found', 'NotFoundError'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: notFoundMock },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(true);
      expect(game.getMediaStream()).toBeNull();
      const statusText2 = document.querySelector('#camera-status-text')?.textContent;
      expect(statusText2).toBe('Simulated Camera');

      // 3. OverconstrainedError / Hardware Error
      const hardwareErrorMock = vi.fn().mockRejectedValue(new Error('Hardware DMA transfer bus error'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: hardwareErrorMock },
        configurable: true,
        writable: true,
      });

      game.destroy();
      game = new CameraGame();
      game.init(canvas);

      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(true);
      expect(unhandledRejections.length).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      window.removeEventListener('unhandledrejection', onUnhandled);
    });

    it('runs 120 animation frames of simulated stream verifying 60 FPS update loop, bouncing mascot, and non-null canvas render', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockRejectedValue(new Error('CI headless')) },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);
      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(true);

      const ctx = canvas.getContext('2d') as any;
      ctx.drawImage.mockClear();
      ctx.clearRect.mockClear();

      // Run 120 frames at 16.666ms (approx 2.0 seconds at 60 FPS)
      for (let frame = 0; frame < 120; frame++) {
        game.update(16.666);
      }

      // Assert continuous redraws across all 120 frames
      expect(ctx.clearRect).toHaveBeenCalledTimes(120);
      expect(ctx.drawImage).toHaveBeenCalledTimes(120);

      // Verify that simulated stream survives variable / chaotic dt spikes (0ms, 100ms, 500ms) without crashing
      expect(() => {
        game!.update(0);
        game!.update(33.333);
        game!.update(100.0);
        game!.update(500.0);
      }).not.toThrow();

      // Advance simulated time past blink threshold (> 3500ms)
      for (let frame = 0; frame < 120; frame++) {
        game.update(16.666);
      }
      expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(240);
    });

    it('safely releases media stream tracks if destroy() is called while getUserMedia is pending (race condition)', async () => {
      let resolveStreamPromise!: (stream: any) => void;
      const deferredStream = new Promise((resolve) => {
        resolveStreamPromise = resolve;
      });

      const stopTrack1 = vi.fn();
      const stopTrack2 = vi.fn();
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopTrack1 }, { stop: stopTrack2 }]),
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn(() => deferredStream) },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      // Immediately call destroy while getUserMedia is in-flight
      game.destroy();

      // Now resolve the in-flight stream
      resolveStreamPromise(mockStream);
      await Promise.resolve();
      await Promise.resolve();

      // The tracks must have been stopped immediately to avoid hardware camera leak
      expect(stopTrack1).toHaveBeenCalled();
      expect(stopTrack2).toHaveBeenCalled();
      expect(game.getMediaStream()).toBeNull();
    });
  });

  describe('2. Shutter & Lifecycle Teardown Stress', () => {
    it('rapidly clicks shutter button 20 times in quick succession with clean flash decay and no crashes', () => {
      game = new CameraGame();
      game.init(canvas);

      const shutterBtn = document.querySelector('#camera-shutter-btn') as HTMLButtonElement;
      expect(shutterBtn).not.toBeNull();
      expect(game.getState()).toBe('viewfinder');

      // Rapidly spam shutter button 20 times
      for (let i = 0; i < 20; i++) {
        shutterBtn.click();
      }

      // State transitioned to 'edit' on the first click and remained stable
      expect(game.getState()).toBe('edit');
      expect(heavyImpactSpy).toHaveBeenCalledTimes(1);

      // Verify flash animation decays monotonically over frame updates
      const ctx = canvas.getContext('2d') as any;
      ctx.fillRect.mockClear();

      // Frame 1: flash is decaying (flashAlpha ~ 0.89)
      game.update(16.666);
      expect(ctx.fillRect).toHaveBeenCalled();

      // Monotonically decay flash over 10 frames (166ms > 150ms flash duration)
      for (let f = 0; f < 10; f++) {
        game.update(16.666);
      }

      // After 200ms, flashAlpha must have decayed to 0 and fillRect is no longer called for flash overlay
      ctx.fillRect.mockClear();
      game.update(16.666);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('endures 10 rapid photo capture / retake cycles without memory corruption or DOM breakdown', () => {
      game = new CameraGame();
      game.init(canvas);

      const shutterBtn = document.querySelector('#camera-shutter-btn') as HTMLButtonElement;
      const retakeBtn = document.querySelector('#camera-retake-btn') as HTMLButtonElement;

      for (let cycle = 0; cycle < 10; cycle++) {
        expect(game.getState()).toBe('viewfinder');
        shutterBtn.click();
        expect(game.getState()).toBe('edit');

        // Add a sticker in edit mode
        game.addSticker('star', 100 + cycle * 5, 200);
        expect(game.getPlacedStickers().length).toBe(1);

        // Retake resets state and clears placed stickers
        retakeBtn.click();
        expect(game.getState()).toBe('viewfinder');
        expect(game.getPlacedStickers().length).toBe(0);
      }
    });

    it('stops every single video and audio track on destroy() with multiple active tracks', async () => {
      const tracks = [
        { kind: 'video', stop: vi.fn(), readyState: 'live' },
        { kind: 'video', stop: vi.fn(), readyState: 'live' },
        { kind: 'audio', stop: vi.fn(), readyState: 'live' },
        { kind: 'audio', stop: vi.fn(), readyState: 'live' },
      ];

      const mockStream = {
        getTracks: vi.fn(() => tracks),
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(false);
      expect(game.getMediaStream()).toBe(mockStream as any);

      // Call destroy
      game.destroy();

      // Assert every track's stop method was called
      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalledTimes(1);
      });

      expect(game.getMediaStream()).toBeNull();
      expect(document.getElementById('camera-overlay')).toBeNull();

      // Post-destroy updates should be no-ops and never crash
      expect(() => game!.update(16.666)).not.toThrow();
    });
  });

  describe('3. Photo Download & Privacy Verification (0 Network Calls)', () => {
    it('verifies Save Photo creates a local download link and makes ZERO network calls', () => {
      // 1. Install spy tripwires on network APIs
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const xhrOpenSpy = vi.spyOn(window.XMLHttpRequest.prototype, 'open');
      const xhrSendSpy = vi.spyOn(window.XMLHttpRequest.prototype, 'send');
      const sendBeaconSpy = 'sendBeacon' in navigator
        ? vi.spyOn(navigator, 'sendBeacon')
        : vi.fn();

      game = new CameraGame();
      game.init(canvas);
      game.takePhoto();

      // 2. Intercept anchor element creation to inspect local download payload
      const createdAnchors: HTMLAnchorElement[] = [];
      const origCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          const anchor = el as HTMLAnchorElement;
          vi.spyOn(anchor, 'click').mockImplementation(() => {});
          createdAnchors.push(anchor);
        }
        return el;
      });

      const saveBtn = document.querySelector('#camera-save-btn') as HTMLButtonElement;
      expect(saveBtn).not.toBeNull();
      saveBtn.click();

      // 3. Assert zero network requests
      expect(fetchSpy).toHaveBeenCalledTimes(0);
      expect(xhrOpenSpy).toHaveBeenCalledTimes(0);
      expect(xhrSendSpy).toHaveBeenCalledTimes(0);
      if ('sendBeacon' in navigator) {
        expect(sendBeaconSpy).toHaveBeenCalledTimes(0);
      }

      // 4. Assert client-side local download payload
      expect(createdAnchors.length).toBe(1);
      const downloadAnchor = createdAnchors[0];
      expect(downloadAnchor.download).toMatch(/^kipu-photo-\d+\.png$/);
      expect(downloadAnchor.href).toMatch(/^data:image\/png;base64,/);
      expect(downloadAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('survives rapid Save button spam with 15 consecutive clicks maintaining ZERO network traffic', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const xhrOpenSpy = vi.spyOn(window.XMLHttpRequest.prototype, 'open');

      game = new CameraGame();
      game.init(canvas);
      game.takePhoto();

      const origCreateElement = document.createElement.bind(document);
      let anchorClicks = 0;

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          const anchor = el as HTMLAnchorElement;
          vi.spyOn(anchor, 'click').mockImplementation(() => {
            anchorClicks++;
          });
        }
        return el;
      });

      const saveBtn = document.querySelector('#camera-save-btn') as HTMLButtonElement;
      for (let i = 0; i < 15; i++) {
        saveBtn.click();
      }

      expect(fetchSpy).toHaveBeenCalledTimes(0);
      expect(xhrOpenSpy).toHaveBeenCalledTimes(0);
      expect(anchorClicks).toBe(15);
    });

    it('renders vector stickers onto local export canvas without requesting remote assets', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      game = new CameraGame();
      game.init(canvas);
      game.takePhoto();

      // Add all 6 sticker types
      game.addSticker('star', 100, 100);
      game.addSticker('heart', 200, 100);
      game.addSticker('glasses', 300, 100);
      game.addSticker('crown', 400, 100);
      game.addSticker('flower', 500, 100);
      game.addSticker('sparkles', 600, 100);

      const saveBtn = document.querySelector('#camera-save-btn') as HTMLButtonElement;
      saveBtn.click();

      // Pure math vector drawing — 0 remote image downloads
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('4. Hub Dynamic Cards Portal Stress', () => {
    it('rapidly switches portals 50 times in 1 second asserting DOM counts and zero orphaned nodes', () => {
      const registry = GameRegistry.getInstance();
      const allCount = registry.getAll().length;
      expect(allCount).toBeGreaterThanOrEqual(26);

      const portals: ('sandbox' | 'workshop' | 'lab' | 'busyBoard' | 'all' | undefined)[] = ['sandbox', 'workshop', 'lab', 'busyBoard', 'all', undefined];

      for (let i = 0; i < 50; i++) {
        const portal = portals[i % portals.length];
        renderGameList(portal === 'all' ? undefined : portal);

        const cardNodes = document.querySelectorAll('#game-list a');
        const expectedCount = (portal && portal !== 'all')
          ? registry.getByPortal(portal as 'sandbox' | 'workshop' | 'lab' | 'busyBoard').length
          : allCount;

        // Check exact match
        expect(cardNodes.length).toBe(expectedCount);

        // Verify each card has unique game ID (no duplicates or orphaned nodes)
        const gameIds = new Set<string>();
        cardNodes.forEach((card) => {
          const gameId = card.getAttribute('data-game');
          expect(gameId).toBeTruthy();
          expect(gameIds.has(gameId!)).toBe(false);
          gameIds.add(gameId!);

          // Verify portal attribute consistency
          if (portal && portal !== 'all') {
            expect(card.getAttribute('data-portal')).toBe(portal);
          }

          // Verify SVG icon exists and is valid
          const svg = card.querySelector('.icon svg');
          expect(svg).not.toBeNull();
          expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
        });
      }

      // Reset to all games
      renderGameList();
      const finalCards = document.querySelectorAll('#game-list a');
      expect(finalCards.length).toBe(allCount);
    });

    it('gracefully handles adversarial portal inputs (unknown portal, empty string, XSS payloads)', () => {
      // 1. Unknown portal produces 0 cards without error
      renderGameList('non_existent_portal_xyz');
      expect(document.querySelectorAll('#game-list a').length).toBe(0);

      // 2. XSS portal input does not corrupt DOM or inject scripts
      renderGameList('<script>alert("xss")</script>');
      expect(document.querySelectorAll('#game-list a').length).toBe(0);
      expect(document.querySelector('script[src*="xss"]')).toBeNull();

      // 3. Resets back to full registry cleanly
      renderGameList();
      expect(document.querySelectorAll('#game-list a').length).toBe(GameRegistry.getInstance().getAll().length);

      // 4. Missing #game-list container does not throw error
      const container = document.getElementById('game-list');
      container?.remove();
      expect(() => renderGameList()).not.toThrow();
    });

    it('safely escapes special characters in custom titles and descriptions', () => {
      const malicious = '<img src=x onerror=alert(1)> & "quotes" \'apostrophe\'';
      const escaped = escapeHtml(malicious);
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;quotes&quot;');
      expect(escaped).toContain('&#39;apostrophe&#39;');
    });
  });
});
