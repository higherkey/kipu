import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CameraGame } from '../src/games/camera/CameraGame';
import { HapticController } from '../src/core/HapticController';

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

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
}

describe('CameraGame (Feature 13 / Issue #33)', () => {
  let game: CameraGame;
  let canvas: HTMLCanvasElement;
  let heavyImpactSpy: ReturnType<typeof vi.spyOn>;
  let lightTapSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      return createMockContext();
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

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
    game?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. MediaStream Permissions & Graceful Simulated Stream Fallback', () => {
    it('gracefully activates simulated stream when navigator.mediaDevices is undefined', () => {
      const origMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true, writable: true });

      game = new CameraGame();
      game.init(canvas);

      expect(game.isUsingMockStream()).toBe(true);
      expect(game.getMediaStream()).toBeNull();

      Object.defineProperty(navigator, 'mediaDevices', { value: origMediaDevices, configurable: true, writable: true });
    });

    it('gracefully falls back to simulated stream when getUserMedia rejects (NotAllowedError)', async () => {
      const getUserMediaMock = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      // Wait a microtask tick for async getUserMedia catch block
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(true);
      expect(game.getMediaStream()).toBeNull();
    });

    it('attaches video element and sets mediaStream when getUserMedia resolves', async () => {
      const stopTrackMock = vi.fn();
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopTrackMock }]),
      };
      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        configurable: true,
        writable: true,
      });

      game = new CameraGame();
      game.init(canvas);

      await Promise.resolve();
      await Promise.resolve();

      expect(game.isUsingMockStream()).toBe(false);
      expect(game.getMediaStream()).toBe(mockStream as any);
    });

    it('stops all media stream tracks on destroy() to release camera hardware LED', async () => {
      const stopTrack1 = vi.fn();
      const stopTrack2 = vi.fn();
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopTrack1 }, { stop: stopTrack2 }]),
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

      game.destroy();

      expect(stopTrack1).toHaveBeenCalled();
      expect(stopTrack2).toHaveBeenCalled();
      expect(game.getMediaStream()).toBeNull();
    });
  });

  describe('2. Photo Filters Mechanics', () => {
    beforeEach(() => {
      game = new CameraGame();
      game.init(canvas);
    });

    it('defaults to normal filter and updates filter state on button clicks', () => {
      expect(game.getFilter()).toBe('normal');

      const sepiaBtn = document.querySelector('[data-filter="sepia"]') as HTMLButtonElement;
      sepiaBtn?.click();
      expect(game.getFilter()).toBe('sepia');
      expect(lightTapSpy).toHaveBeenCalled();

      const invertBtn = document.querySelector('[data-filter="invert"]') as HTMLButtonElement;
      invertBtn?.click();
      expect(game.getFilter()).toBe('invert');

      const comicBtn = document.querySelector('[data-filter="comic"]') as HTMLButtonElement;
      comicBtn?.click();
      expect(game.getFilter()).toBe('comic');
    });

    it('correctly applies software pixel filter algorithms', () => {
      const width = 2;
      const height = 2;
      const buffer = new Uint8ClampedArray([
        100, 150, 200, 255,
        50, 80, 120, 255,
        0, 0, 0, 255,
        255, 255, 255, 255,
      ]);
      const mockCtx: any = {
        getImageData: vi.fn(() => ({ data: buffer, width, height })),
        putImageData: vi.fn(),
      };

      // Test Invert Filter
      game.applySoftwareFilter(mockCtx, width, height, 'invert');
      expect(buffer[0]).toBe(155); // 255 - 100
      expect(buffer[1]).toBe(105); // 255 - 150
      expect(buffer[2]).toBe(55);  // 255 - 200
      expect(mockCtx.putImageData).toHaveBeenCalled();
    });
  });

  describe('3. Shutter Sound, Haptics & Photo Capture Flow', () => {
    beforeEach(() => {
      game = new CameraGame();
      game.init(canvas);
    });

    it('triggers shutter audio, heavy haptics, and switches to edit mode on shutter click', () => {
      expect(game.getState()).toBe('viewfinder');

      const shutterBtn = document.querySelector('#camera-shutter-btn') as HTMLButtonElement;
      shutterBtn?.click();

      expect(game.getState()).toBe('edit');
      expect(heavyImpactSpy).toHaveBeenCalled();

      // UI controls toggle
      expect(document.querySelector('#camera-filters-group')?.classList.contains('hidden')).toBe(true);
      expect(document.querySelector('#camera-actions-group')?.classList.contains('hidden')).toBe(false);
      expect(document.querySelector('#camera-shutter-group')?.classList.contains('hidden')).toBe(true);
      expect(document.querySelector('#camera-tools-group')?.classList.contains('hidden')).toBe(false);
    });

    it('returns to viewfinder when retake button is clicked', () => {
      game.takePhoto();
      expect(game.getState()).toBe('edit');

      const retakeBtn = document.querySelector('#camera-retake-btn') as HTMLButtonElement;
      retakeBtn?.click();

      expect(game.getState()).toBe('viewfinder');
      expect(document.querySelector('#camera-filters-group')?.classList.contains('hidden')).toBe(false);
      expect(document.querySelector('#camera-actions-group')?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('4. Sticker Overlays & Creative Doodling', () => {
    beforeEach(() => {
      game = new CameraGame();
      game.init(canvas);
      game.takePhoto();
    });

    it('switches between crayons and stickers tabs', () => {
      const stickersTab = document.querySelector('#tab-stickers') as HTMLButtonElement;
      stickersTab?.click();

      expect(document.querySelector('#camera-crayons-palette')?.classList.contains('hidden')).toBe(true);
      expect(document.querySelector('#camera-stickers-palette')?.classList.contains('hidden')).toBe(false);

      const crayonsTab = document.querySelector('#tab-crayons') as HTMLButtonElement;
      crayonsTab?.click();

      expect(document.querySelector('#camera-crayons-palette')?.classList.contains('hidden')).toBe(false);
      expect(document.querySelector('#camera-stickers-palette')?.classList.contains('hidden')).toBe(true);
    });

    it('stamps stickers and tracks placed stickers', () => {
      const stickersTab = document.querySelector('#tab-stickers') as HTMLButtonElement;
      stickersTab?.click();

      game.addSticker('star', 200, 300);
      game.addSticker('heart', 400, 300);

      const stickers = game.getPlacedStickers();
      expect(stickers.length).toBe(2);
      expect(stickers[0].type).toBe('star');
      expect(stickers[0].x).toBe(200);
      expect(stickers[1].type).toBe('heart');
    });

    it('clears placed stickers when clear button is clicked', () => {
      game.addSticker('star', 200, 300);
      expect(game.getPlacedStickers().length).toBe(1);

      const clearBtn = document.querySelector('#camera-clear-btn') as HTMLButtonElement;
      clearBtn?.click();

      expect(game.getPlacedStickers().length).toBe(0);
    });
  });

  describe('5. Local-Only Child-Safety Contract', () => {
    beforeEach(() => {
      game = new CameraGame();
      game.init(canvas);
      game.takePhoto();
    });

    it('triggers purely local download link with zero network requests on save', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      let createdDownloadLink: HTMLAnchorElement | null = null;

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          createdDownloadLink = el as HTMLAnchorElement;
          vi.spyOn(createdDownloadLink, 'click').mockImplementation(() => {});
        }
        return el;
      });

      const saveBtn = document.querySelector('#camera-save-btn') as HTMLButtonElement;
      saveBtn?.click();

      // Zero network calls
      expect(fetchSpy).not.toHaveBeenCalled();

      // Download triggered locally
      expect(createdDownloadLink).not.toBeNull();
      expect((createdDownloadLink as any)?.download).toMatch(/^kipu-photo-\d+\.png$/);
    });
  });

  describe('6. Sitewright Core Standards Compliance', () => {
    beforeEach(() => {
      game = new CameraGame();
      game.init(canvas);
    });

    it('ensures overlay and all children have zero inline style attributes', () => {
      const overlay = document.getElementById('camera-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.getAttribute('style')).toBeNull();

      const descendants = overlay?.querySelectorAll('*') || [];
      expect(descendants.length).toBeGreaterThan(0);
      descendants.forEach((child) => {
        expect(child.getAttribute('style')).toBeNull();
      });
    });

    it('ensures all interactive buttons have touch target compliant classes', () => {
      const shutter = document.querySelector('.camera-shutter-btn');
      const filterBtns = document.querySelectorAll('.camera-filter-btn');
      const actionBtns = document.querySelectorAll('.camera-action-btn');
      const swatches = document.querySelectorAll('.crayon-swatch-btn');
      const stickerBtns = document.querySelectorAll('.sticker-select-btn');

      expect(shutter).not.toBeNull();
      expect(filterBtns.length).toBe(4);
      expect(actionBtns.length).toBe(3);
      expect(swatches.length).toBe(6);
      expect(stickerBtns.length).toBe(6);
    });
  });

  describe('7. Teardown & Lifecycle', () => {
    it('cleans up DOM overlay and handles frame update after destroy without crashing', () => {
      game = new CameraGame();
      game.init(canvas);

      expect(document.getElementById('camera-overlay')).not.toBeNull();

      game.destroy();

      expect(document.getElementById('camera-overlay')).toBeNull();
      expect(() => game.update(16)).not.toThrow();
    });
  });
});
