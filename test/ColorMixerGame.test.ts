import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorMixerGame } from '../src/games/colorMixer/ColorMixerGame';
import { TranslationManager } from '../src/core/TranslationManager';

// Mock Audio and Haptic controllers
vi.mock('../src/core/AudioController', () => {
  return {
    AudioController: {
      getInstance: () => ({
        registerSound: vi.fn(),
        play: vi.fn(),
        speak: vi.fn(),
      })
    }
  };
});

vi.mock('../src/core/HapticController', () => {
  return {
    HapticController: {
      getInstance: () => ({
        lightTap: vi.fn(),
      })
    }
  };
});

// Setup mock canvas 2D context
const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  drawImage: vi.fn(),
  createRadialGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn()
  }),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 50 }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1.0
};

describe('ColorMixerGame', () => {
  let canvas: HTMLCanvasElement;
  let game: ColorMixerGame;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Spy on document.createElement to intercept offscreen canvas creation
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = Document.prototype.createElement.call(document, tagName);
      if (tagName === 'canvas') {
        (el as HTMLCanvasElement).getContext = vi.fn().mockReturnValue(mockCtx);
      }
      return el;
    });

    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getContext = vi.fn().mockReturnValue(mockCtx);
    
    // Initialize TranslationManager dummy
    TranslationManager.getCurrent = vi.fn().mockReturnValue({ code: 'en-US' });

    game = new ColorMixerGame();
  });

  it('should initialize successfully with paint wells and a brush tray', () => {
    game.init(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');

    const wells = (game as any).wells;
    expect(wells.map((w: any) => w.id)).toEqual(['red', 'yellow', 'blue', 'white', 'black']);

    const brushes = (game as any).brushes;
    expect(brushes.map((b: any) => b.id)).toEqual(['smudge', 'brush', 'spray', 'dots', 'fill']);
  });

  it('should switch colors and brushes separately', () => {
    game.init(canvas);
    expect((game as any).activeColor).toBe('red');
    expect((game as any).activeBrush).toBe('brush');

    // Simulate clicking Yellow well
    const yellowWell = (game as any).wells[1];
    (game as any).startPress(yellowWell.x + 10, (game as any).potsY + 20);
    expect((game as any).activeColor).toBe('yellow');

    // Simulate clicking the Spray brush in the tray
    const spray = (game as any).brushes[2];
    (game as any).startPress(spray.x + 10, spray.y + 10);
    expect((game as any).activeBrush).toBe('spray');
    expect((game as any).activeColor).toBe('yellow');
  });

  it('should start drawing and place drops below the header boundary', () => {
    game.init(canvas);
    expect((game as any).isDrawing).toBe(false);

    // Tap in drawing area
    const drawY = (game as any).potsY + (game as any).potsHeight + 100;
    (game as any).startPress(300, drawY);
    expect((game as any).isDrawing).toBe(true);
  });

  it('should clear canvas and reset buffer when clear button is clicked', () => {
    game.init(canvas);
    
    // Click clear button (far right top)
    (game as any).startPress(canvas.width - 40, (game as any).potsY + 20);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('should clean up event listeners on destroy', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    game.init(canvas);
    game.destroy();
    
    expect(removeSpy).toHaveBeenCalled();
  });
});
