import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KhipuSynthGame, type KhipuPatternExport } from '../src/games/khipuSynth/KhipuSynthGame';

function createMockCanvas(w = 800, h = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: w,
    bottom: h,
    width: w,
    height: h,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  return canvas;
}

describe('KhipuSynth Pattern Serialization & URL Sharing (Issue #30)', () => {
  let canvas: HTMLCanvasElement;
  let game: KhipuSynthGame;

  beforeEach(() => {
    (globalThis as any).AudioContext = class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      createGain = vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      createAnalyser = vi.fn(() => ({
        fftSize: 64,
        frequencyBinCount: 32,
        connect: vi.fn(),
        getByteFrequencyData: vi.fn(),
      }));
      createBiquadFilter = vi.fn(() => ({
        type: 'lowpass',
        Q: { value: 1 },
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    };
    (window as any).AudioContext = (globalThis as any).AudioContext;

    localStorage.clear();
    canvas = createMockCanvas();
    document.body.appendChild(canvas);
    game = new KhipuSynthGame();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
    canvas.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Pattern Export & JSON Schema Compliance', () => {
    it('exports a valid KhipuPatternExport object with 8 tracks and 16 steps each', () => {
      const exported = game.exportPattern();

      expect(exported.version).toBe(1);
      expect(typeof exported.bpm).toBe('number');
      expect(exported.bpm).toBeGreaterThanOrEqual(60);
      expect(exported.bpm).toBeLessThanOrEqual(180);
      expect(exported.tracks).toHaveLength(8);

      exported.tracks.forEach((track, i) => {
        expect(track.id).toBe(i);
        expect(typeof track.instrument).toBe('string');
        expect(typeof track.note).toBe('string');
        expect(track.steps).toHaveLength(16);
        expect(typeof track.steps[0]).toBe('boolean');
      });
    });

    it('exports valid JSON string via exportPatternJson', () => {
      const json = game.exportPatternJson();
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.tracks).toHaveLength(8);
    });
  });

  describe('2. Pattern Import & Deep Validation', () => {
    it('imports a custom valid pattern and updates sequencer tracks and BPM', () => {
      const customPattern: KhipuPatternExport = {
        version: 1,
        bpm: 140,
        tracks: [
          { id: 0, instrument: 'bell', note: 'C5', steps: [true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false] },
          { id: 1, instrument: 'pluck', note: 'A4', steps: new Array(16).fill(false) },
          { id: 2, instrument: 'chime', note: 'G4', steps: new Array(16).fill(false) },
          { id: 3, instrument: 'marimba', note: 'E4', steps: new Array(16).fill(false) },
          { id: 4, instrument: 'flute', note: 'D4', steps: new Array(16).fill(false) },
          { id: 5, instrument: 'bass', note: 'C4', steps: new Array(16).fill(false) },
          { id: 6, instrument: 'drum', note: 'A3', steps: new Array(16).fill(false) },
          { id: 7, instrument: 'click', note: 'G3', steps: new Array(16).fill(false) },
        ],
      };

      const success = game.importPattern(customPattern);
      expect(success).toBe(true);

      const exported = game.exportPattern();
      expect(exported.bpm).toBe(140);
      expect(exported.tracks[0].steps[0]).toBe(true);
      expect(exported.tracks[0].steps[1]).toBe(false);
      expect(exported.tracks[0].steps[2]).toBe(true);
    });

    it('clamps out-of-range BPM values into safe range [60, 180]', () => {
      const patternOver: KhipuPatternExport = {
        version: 1,
        bpm: 999,
        tracks: game.exportPattern().tracks,
      };
      game.importPattern(patternOver);
      expect(game.exportPattern().bpm).toBe(180);

      const patternUnder: KhipuPatternExport = {
        version: 1,
        bpm: -50,
        tracks: game.exportPattern().tracks,
      };
      game.importPattern(patternUnder);
      expect(game.exportPattern().bpm).toBe(60);
    });

    it('rejects malformed payloads gracefully without throwing', () => {
      expect(game.importPattern(null as any)).toBe(false);
      expect(game.importPattern(undefined as any)).toBe(false);
      expect(game.importPattern('' as any)).toBe(false);
      expect(game.importPattern('{ invalid json }')).toBe(false);
      expect(game.importPattern({ version: 2, tracks: [] } as any)).toBe(false);
      expect(game.importPattern({ version: 1, tracks: [1, 2, 3] } as any)).toBe(false); // only 3 tracks
    });
  });

  describe('3. Local Storage Persistence', () => {
    it('saves pattern to localStorage and loads it back accurately', () => {
      // Modify track 0 step 5
      game.clearPattern();
      const pattern = game.exportPattern();
      pattern.tracks[0].steps[5] = true;
      pattern.bpm = 100;
      game.importPattern(pattern);

      game.saveToStorage('test_khipu_save');

      // Create a second game instance and load
      const game2 = new KhipuSynthGame();
      const loaded = game2.loadFromStorage('test_khipu_save');
      expect(loaded).toBe(true);

      const exported2 = game2.exportPattern();
      expect(exported2.bpm).toBe(100);
      expect(exported2.tracks[0].steps[5]).toBe(true);
      game2.destroy();
    });

    it('returns false when loading non-existent storage key', () => {
      expect(game.loadFromStorage('non_existent_key')).toBe(false);
    });
  });

  describe('4. URL Hash Generation & Round-Trip Sharing', () => {
    it('generates a valid URL hash containing encoded pattern', () => {
      const shareUrl = game.getShareUrl();
      expect(shareUrl).toContain('#/game/khipuSynth#pattern=');
    });

    it('decodes and loads a shared pattern from URL string successfully', () => {
      // Set distinct pattern
      game.clearPattern();
      const pattern = game.exportPattern();
      pattern.tracks[2].steps[7] = true;
      pattern.bpm = 150;
      game.importPattern(pattern);

      const shareUrl = game.getShareUrl();

      // Second game instance loads from that URL
      const game2 = new KhipuSynthGame();
      const loaded = game2.loadFromUrl(shareUrl);
      expect(loaded).toBe(true);

      const exported2 = game2.exportPattern();
      expect(exported2.bpm).toBe(150);
      expect(exported2.tracks[2].steps[7]).toBe(true);
      game2.destroy();
    });

    it('handles corrupted pattern query parameter gracefully', () => {
      expect(game.loadFromUrl('https://kipu.app/#/game/khipuSynth#pattern=corrupted%invalid')).toBe(false);
      expect(game.loadFromUrl('https://kipu.app/#/game/khipuSynth')).toBe(false);
    });
  });
});
