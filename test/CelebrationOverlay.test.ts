import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CelebrationOverlay } from '../src/ui/CelebrationOverlay';
import { AudioController } from '../src/core/AudioController';
import { EquationTowerGame } from '../src/games/equationTower/EquationTowerGame';
import { VibeCoderGame } from '../src/games/vibeCoder/VibeCoderGame';
import { TrashSorcererGame } from '../src/games/trashSorcerer/TrashSorcererGame';

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

describe('Global Visual Micro-Reward Particle Overlays (Issue #32)', () => {
  let container: HTMLDivElement;
  let overlay: CelebrationOverlay;

  beforeEach(() => {
    vi.spyOn(AudioController.getInstance(), 'registerSound').mockImplementation(() => {});
    vi.spyOn(AudioController.getInstance(), 'play').mockImplementation(() => {});
    container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);
    overlay = CelebrationOverlay.getInstance();
  });

  afterEach(() => {
    overlay.clear();
    overlay.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  describe('1. Overlay Lifecycle & Particle Pooling', () => {
    it('creates a singleton instance and attaches accessible canvas and announcer', () => {
      overlay.celebrate({ count: 20, message: 'Level Complete!' });

      const canvas = document.querySelector('.celebration-overlay-canvas');
      const announcer = document.querySelector('.celebration-announcer');

      expect(canvas).not.toBeNull();
      expect(announcer).not.toBeNull();
      expect(announcer?.textContent).toBe('Level Complete!');
      expect(overlay.getActiveCount()).toBe(20);
    });

    it('caps maximum particle spawn count to prevent frame drops on mobile', () => {
      overlay.celebrate({ count: 500 });
      expect(overlay.getActiveCount()).toBeLessThanOrEqual(80);
    });

    it('simulates particle physics decay and auto-terminates', () => {
      overlay.celebrate({ count: 30 });
      expect(overlay.getActiveCount()).toBe(30);

      // Advance physics simulation by 5 seconds
      for (let i = 0; i < 50; i++) {
        overlay.updateAndRender(0.1);
      }

      // All particles should have fallen or decayed
      expect(overlay.getActiveCount()).toBe(0);
    });

    it('clears all active particles immediately when clear() is invoked', () => {
      overlay.celebrate({ count: 40 });
      expect(overlay.getActiveCount()).toBe(40);

      overlay.clear();
      expect(overlay.getActiveCount()).toBe(0);
    });
  });

  describe('2. STEM Game Integration (Issue #32)', () => {
    it('triggers celebration upon solving an equation in EquationTowerGame', () => {
      const celebrateSpy = vi.spyOn(overlay, 'celebrate');
      const game = new EquationTowerGame();
      const canvas = createMockCanvas();
      container.appendChild(canvas);
      game.init(canvas);

      // Trigger win in EquationTower
      (game as any).triggerWin();

      expect(celebrateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confetti',
          message: expect.stringContaining('Equation solved!'),
        })
      );

      game.destroy();
      canvas.remove();
    });

    it('triggers starburst celebration upon reaching the maze goal in VibeCoderGame', () => {
      const celebrateSpy = vi.spyOn(overlay, 'celebrate');
      const game = new VibeCoderGame();
      const canvas = createMockCanvas();
      container.appendChild(canvas);
      game.init(canvas);

      // Set player at goal position
      (game as any).playerPos = { ...(game as any).goalPos };
      (game as any).checkGoal();

      expect(celebrateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stars',
          message: expect.stringContaining('Maze solved!'),
        })
      );

      game.destroy();
      canvas.remove();
    });

    it('triggers fireworks celebration upon reaching a score milestone in TrashSorcererGame', () => {
      const celebrateSpy = vi.spyOn(overlay, 'celebrate');
      const game = new TrashSorcererGame();
      const canvas = createMockCanvas();
      container.appendChild(canvas);
      game.init(canvas);

      // Feed item that reaches 50 score
      (game as any).score = 40;
      const mockItem = { id: 1, body: {}, category: 'RECYCLING' };
      const mockPortal = { category: 'RECYCLING', x: 200, y: 300, color: '#3b82f6' };

      (game as any).handlePortalEntry(mockItem, mockPortal);

      expect((game as any).score).toBe(50);
      expect(celebrateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fireworks',
          message: expect.stringContaining('Score: 50'),
        })
      );

      game.destroy();
      canvas.remove();
    });
  });
});
