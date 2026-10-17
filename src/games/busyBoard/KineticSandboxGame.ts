import type { Game } from '../../core/Game';
import type { BusyBoardModule } from './BusyBoardModule';
import { BoardModuleRegistry } from './BoardModuleRegistry';
import { AudioController } from '../../core/AudioController';

export class KineticSandboxGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private modules: BusyBoardModule[] = [];
  private activeDragModule: BusyBoardModule | null = null;

  // 3-column x 2-row modular grid layout
  private cols = 3;
  private rows = 2;
  private cellW = 0;
  private cellH = 0;

  // Horizontal pan/scroll state for mobile / narrow viewports
  private scrollX = 0;
  private maxScrollX = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartScrollX = 0;

  constructor() {}

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Register kinetic sensory audio effects
    const audio = AudioController.getInstance();
    audio.registerSound('busyboard:pendulum_tick', '/sounds/busyBoard/toggle_on.wav');
    audio.registerSound('busyboard:whoosh_air', '/sounds/busyBoard/breaker_flip.wav');
    audio.registerSound('busyboard:sand_flow', '/sounds/busyBoard/weight_slide.wav');
    audio.registerSound('busyboard:chime_peg', '/sounds/busyBoard/arcade_button.wav');
    audio.registerSound('busyboard:metal_clack', '/sounds/busyBoard/knife_close.wav');

    this.setupLayout();
    this.setupModules();

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', this.handleMouseDown);
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('mouseup', this.handleMouseUp);
      this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

      this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
      this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
      this.canvas.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
    }
  }

  private setupLayout() {
    if (!this.canvas) return;
    this.cols = 3;
    this.rows = 2;

    // Minimum cell width 300px prevents squishing
    this.cellW = Math.max(300, this.canvas.width / this.cols);
    this.cellH = this.canvas.height / this.rows;

    const boardWidth = this.cols * this.cellW;
    this.maxScrollX = Math.max(0, boardWidth - this.canvas.width);
    this.scrollX = Math.min(this.scrollX, this.maxScrollX);
  }

  private setupModules() {
    this.modules = [];

    // Board 6 Layout (3x2):
    // Row 0: [051: HangingPendulum], [052: PinwheelHub], [054: HourglassInverter]
    // Row 1: [058: NewtonsCradle],   [055: PlinkoFunnel], [057: BellowsPump]
    const layouts = [
      { id: '051', col: 0, row: 0, w: 1, h: 1 },
      { id: '052', col: 1, row: 0, w: 1, h: 1 },
      { id: '054', col: 2, row: 0, w: 1, h: 1 },
      { id: '058', col: 0, row: 1, w: 1, h: 1 },
      { id: '055', col: 1, row: 1, w: 1, h: 1 },
      { id: '057', col: 2, row: 1, w: 1, h: 1 },
    ];

    layouts.forEach(layout => {
      const Constructor = BoardModuleRegistry[layout.id];
      if (!Constructor) {
        console.warn(`Module constructor for ID ${layout.id} not found.`);
        return;
      }

      const instance = new Constructor(
        layout.id,
        layout.col,
        layout.row,
        layout.w,
        layout.h,
        this
      );
      instance.init();
      this.modules.push(instance);
    });
  }

  public update(dt: number): void {
    const dtSec = dt > 1 ? dt / 1000 : dt;
    const clampedDt = Math.max(0.001, Math.min(0.05, Number.isFinite(dtSec) ? dtSec : 0.016));

    this.modules.forEach(module => {
      if ((module as any).update) {
        const px = module.x * this.cellW;
        const py = module.y * this.cellH;
        const pw = module.w * this.cellW;
        const ph = module.h * this.cellH;
        (module as any).update(clampedDt, px, py, pw, ph);
      }
    });

    this.render();
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply horizontal panning
    this.ctx.translate(-this.scrollX, 0);

    // Render Board Grid Lines & Base Wooden Workbench Texture
    this.renderBoardBackground();

    // Render each module in local transformed grid slot
    this.modules.forEach(module => {
      const px = module.x * this.cellW;
      const py = module.y * this.cellH;
      const pw = module.w * this.cellW;
      const ph = module.h * this.cellH;

      this.ctx?.save();
      module.render(this.ctx!, px, py, pw, ph);
      this.ctx?.restore();
    });

    this.ctx.restore();

    // Draw scroll navigation indicators on screen boundaries
    this.renderScrollIndicators();
  }

  private renderBoardBackground(): void {
    if (!this.ctx || !this.canvas) return;

    const boardW = this.cols * this.cellW;
    const boardH = this.canvas.height;

    // Dark Industrial Tactile Workbench Slate
    this.ctx.fillStyle = '#1E252D';
    this.ctx.fillRect(0, 0, boardW, boardH);

    // Brass accent grid lines
    this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    this.ctx.lineWidth = 2;

    for (let c = 0; c <= this.cols; c++) {
      const x = c * this.cellW;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, boardH);
      this.ctx.stroke();
    }

    for (let r = 0; r <= this.rows; r++) {
      const y = r * this.cellH;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(boardW, y);
      this.ctx.stroke();
    }
  }

  private renderScrollIndicators(): void {
    if (!this.ctx || !this.canvas || this.maxScrollX <= 0) return;

    const size = 14;
    const centerY = this.canvas.height / 2;

    // Left arrow
    if (this.scrollX > 10) {
      this.ctx.save();
      this.ctx.fillStyle = '#E5E9F0';
      this.ctx.beginPath();
      this.ctx.moveTo(18, centerY);
      this.ctx.lineTo(32, centerY - size);
      this.ctx.lineTo(32, centerY + size);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }

    // Right arrow
    if (this.scrollX < this.maxScrollX - 10) {
      this.ctx.save();
      this.ctx.fillStyle = '#E5E9F0';
      this.ctx.beginPath();
      this.ctx.moveTo(this.canvas.width - 18, centerY);
      this.ctx.lineTo(this.canvas.width - 32, centerY - size);
      this.ctx.lineTo(this.canvas.width - 32, centerY + size);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  // Pointer & Touch Events
  private handleMouseDown = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + this.scrollX;
    const y = e.clientY - rect.top;
    this.processPointerDown(x, y, e.clientX);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + this.scrollX;
    const y = e.clientY - rect.top;
    this.processPointerMove(x, y, e.clientX);
  };

  private handleMouseUp = () => {
    this.processPointerUp();
  };

  private handleMouseLeave = () => {
    this.processPointerUp();
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.canvas || e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left + this.scrollX;
    const y = touch.clientY - rect.top;
    this.processPointerDown(x, y, touch.clientX);
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.canvas || e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left + this.scrollX;
    const y = touch.clientY - rect.top;
    this.processPointerMove(x, y, touch.clientX);
  };

  private handleTouchEnd = () => {
    this.processPointerUp();
  };

  private handleTouchCancel = () => {
    this.processPointerUp();
  };

  private processPointerDown(x: number, y: number, screenX: number): void {
    let hitModule = false;

    for (const module of this.modules) {
      const px = module.x * this.cellW;
      const py = module.y * this.cellH;
      const pw = module.w * this.cellW;
      const ph = module.h * this.cellH;

      if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
        if (module.handlePointerDown(x, y, px, py, pw, ph)) {
          this.activeDragModule = module;
          hitModule = true;
          break;
        }
      }
    }

    if (!hitModule && this.maxScrollX > 0) {
      this.isPanning = true;
      this.panStartX = screenX;
      this.panStartScrollX = this.scrollX;
    }
  }

  private processPointerMove(x: number, y: number, screenX: number): void {
    if (this.activeDragModule) {
      const px = this.activeDragModule.x * this.cellW;
      const py = this.activeDragModule.y * this.cellH;
      const pw = this.activeDragModule.w * this.cellW;
      const ph = this.activeDragModule.h * this.cellH;
      this.activeDragModule.handlePointerMove(x, y, px, py, pw, ph);
    } else if (this.isPanning) {
      const dx = screenX - this.panStartX;
      this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.panStartScrollX - dx));
    }
  }

  private processPointerUp(): void {
    if (this.activeDragModule) {
      const px = this.activeDragModule.x * this.cellW;
      const py = this.activeDragModule.y * this.cellH;
      const pw = this.activeDragModule.w * this.cellW;
      const ph = this.activeDragModule.h * this.cellH;
      this.activeDragModule.handlePointerUp(0, 0, px, py, pw, ph);
      this.activeDragModule = null;
    }
    this.isPanning = false;
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.setupLayout();
  }

  public pause(): void {}

  public resume(): void {}

  public destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
      this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
      this.canvas = null;
      this.ctx = null;
    }

    this.modules.forEach(m => m.destroy());
    this.modules = [];
    this.activeDragModule = null;
  }
}
