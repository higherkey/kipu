import type { Game } from '../../core/Game';
import type { BusyBoardModule } from './BusyBoardModule';
import { BoardModuleRegistry } from './BoardModuleRegistry';
import { AudioController } from '../../core/AudioController';

export class MechanicalWorkshopGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private modules: BusyBoardModule[] = [];
  private activeDragModule: BusyBoardModule | null = null;

  // Layout parameters
  private cols = 4;
  private rows = 3;
  private cellW = 0;
  private cellH = 0;

  // Scrolling state
  private scrollX = 0;
  private maxScrollX = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartScrollX = 0;

  constructor() {}

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Register click/ticking sounds if needed
    const audio = AudioController.getInstance();
    audio.registerSound('busyboard:toggle_on', '/sounds/busyBoard/toggle_on.wav');
    audio.registerSound('busyboard:toggle_off', '/sounds/busyBoard/toggle_off.wav');
    audio.registerSound('busyboard:dip', '/sounds/busyBoard/dip.wav');
    audio.registerSound('busyboard:key_turn', '/sounds/busyBoard/key_turn.wav');
    audio.registerSound('busyboard:push_button', '/sounds/busyBoard/push_button.wav');

    this.setupLayout();
    this.setupModules();

    // Event listeners
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', this.handleMouseDown);
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('mouseup', this.handleMouseUp);

      this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
      this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    }
  }

  private setupLayout() {
    if (!this.canvas) return;
    this.cols = 4;
    this.rows = 3;

    // Minimum column width of 300px prevents squishing
    this.cellW = Math.max(300, this.canvas.width / this.cols);
    this.cellH = this.canvas.height / this.rows;

    const boardWidth = this.cols * this.cellW;
    this.maxScrollX = Math.max(0, boardWidth - this.canvas.width);
    this.scrollX = Math.min(this.scrollX, this.maxScrollX);
  }

  private setupModules() {
    this.modules = [];

    // Board 3 Layout: [col, row, width, height]
    const layouts = [
      { id: '021', col: 0, row: 0, w: 1, h: 1 }, // GearTrainTrio
      { id: '024', col: 0, row: 1, w: 1, h: 1 }, // BarrelBoltLatch
      { id: '025', col: 0, row: 2, w: 1, h: 1 }, // SpringDoorstop

      { id: '022', col: 1, row: 0, w: 1, h: 1 }, // Two-Prong Outlet
      { id: '027', col: 1, row: 1, w: 1, h: 1 }, // HeavyHandCrank
      { id: '030', col: 1, row: 2, w: 1, h: 1 }, // ThreadedScrew

      { id: '023', col: 2, row: 0, w: 1, h: 2 }, // 3.5mm Audio Jack (Double height)
      { id: '028', col: 2, row: 2, w: 1, h: 1 }, // Heavy-Duty Zipper

      { id: '026', col: 3, row: 0, w: 1, h: 2 }, // Rotary Telephone (Double height)
      { id: '029', col: 3, row: 2, w: 1, h: 1 }, // TumblerCombination
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

  public update(_dt: number): void {
    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply horizontal translation for scrolling
    this.ctx.save();
    this.ctx.translate(-this.scrollX, 0);

    const boardWidth = this.cols * this.cellW;

    // Draw main background color - Wooden workshop theme
    this.ctx.fillStyle = '#D7CCC8'; // light wood/corkboard color
    this.ctx.fillRect(0, 0, boardWidth, this.canvas.height);

    // Draw module grid dividing lines
    this.ctx.strokeStyle = '#BCAE97';
    this.ctx.lineWidth = 4;
    for (let c = 1; c < this.cols; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * this.cellW, 0);
      this.ctx.lineTo(c * this.cellW, this.canvas.height);
      this.ctx.stroke();
    }
    for (let r = 1; r < this.rows; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * this.cellH);
      this.ctx.lineTo(boardWidth, r * this.cellH);
      this.ctx.stroke();
    }

    // Render modules
    this.modules.forEach(mod => {
      const box = this.getModuleRenderBox(mod);
      mod.render(this.ctx!, box.x, box.y, box.w, box.h);
    });

    this.ctx.restore(); // Restore scroll translation

    // Draw visual hints if the board can scroll
    this.drawScrollIndicators();
  }

  private drawScrollIndicators() {
    if (!this.ctx || !this.canvas) return;

    const arrowColor = 'rgba(90, 86, 76, 0.4)';
    const size = 15;
    const centerY = this.canvas.height / 2;

    // Left indicator
    if (this.scrollX > 10) {
      this.ctx.save();
      this.ctx.fillStyle = arrowColor;
      this.ctx.beginPath();
      this.ctx.moveTo(20, centerY);
      this.ctx.lineTo(35, centerY - size);
      this.ctx.lineTo(35, centerY + size);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }

    // Right indicator
    if (this.scrollX < this.maxScrollX - 10) {
      this.ctx.save();
      this.ctx.fillStyle = arrowColor;
      this.ctx.beginPath();
      this.ctx.moveTo(this.canvas.width - 20, centerY);
      this.ctx.lineTo(this.canvas.width - 35, centerY - size);
      this.ctx.lineTo(this.canvas.width - 35, centerY + size);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private getModuleRenderBox(mod: BusyBoardModule) {
    const px = mod.x * this.cellW;
    const py = mod.y * this.cellH;
    const availW = mod.w * this.cellW;
    const availH = mod.h * this.cellH;

    const targetAspect = mod.w / mod.h;
    const availAspect = availW / availH;

    let rw = availW;
    let rh = availH;
    let rx = px;
    let ry = py;

    if (availAspect > targetAspect) {
      rw = availH * targetAspect;
      rx = px + (availW - rw) / 2;
    } else {
      rh = availW / targetAspect;
      ry = py + (availH - rh) / 2;
    }

    return { x: rx, y: ry, w: rw, h: rh };
  }

  // Pointer coordination helpers
  private handleMouseDown = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.processPointerDown(x, y);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.processPointerMove(x, y);
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.processPointerUp(x, y);
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerDown(x, y);
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerMove(x, y);
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerUp(x, y);
  };

  private processPointerDown(x: number, y: number) {
    this.activeDragModule = null;
    this.isPanning = false;

    const worldX = x + this.scrollX;

    for (let i = 0; i < this.modules.length; i++) {
      const mod = this.modules[i];
      const box = this.getModuleRenderBox(mod);

      if (mod.handlePointerDown(worldX, y, box.x, box.y, box.w, box.h)) {
        this.activeDragModule = mod;
        break;
      }
    }

    if (!this.activeDragModule && this.maxScrollX > 0) {
      this.isPanning = true;
      this.panStartX = x;
      this.panStartScrollX = this.scrollX;
    }
  }

  private processPointerMove(x: number, y: number) {
    if (this.isPanning) {
      const deltaX = x - this.panStartX;
      this.scrollX = this.panStartScrollX - deltaX;
      this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX));
      return;
    }

    if (!this.activeDragModule) return;

    const mod = this.activeDragModule;
    const box = this.getModuleRenderBox(mod);
    const worldX = x + this.scrollX;

    mod.handlePointerMove(worldX, y, box.x, box.y, box.w, box.h);
  }

  private processPointerUp(x: number, y: number) {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (!this.activeDragModule) return;

    const mod = this.activeDragModule;
    const box = this.getModuleRenderBox(mod);
    const worldX = x + this.scrollX;

    mod.handlePointerUp(worldX, y, box.x, box.y, box.w, box.h);
    this.activeDragModule = null;
  }

  public pause(): void {}
  public resume(): void {}

  public resize(_width: number, _height: number): void {
    this.setupLayout();
  }

  public destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);

      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
    this.modules.forEach(mod => mod.destroy());
  }
}
