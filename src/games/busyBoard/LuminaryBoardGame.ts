import type { Game } from '../../core/Game';
import type { BusyBoardModule } from './BusyBoardModule';
import { BoardModuleRegistry } from './BoardModuleRegistry';
import { AudioController } from '../../core/AudioController';

export class LuminaryBoardGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private modules: BusyBoardModule[] = [];
  private activeDragModule: BusyBoardModule | null = null;

  // Layout parameters
  private cols = 5;
  private rows = 3;
  private cellW = 0;
  private cellH = 0;

  // Scrolling state
  private scrollX = 0;
  private maxScrollX = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartScrollX = 0;

  // Luminary states
  private theme: 'paper' | 'neon' = 'paper';
  private rgb = { r: 0.5, g: 0.5, b: 0.5 };

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
    this.cols = 5;
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

    // Board 2 Layout: [col, row, width, height]
    const layouts = [
      { id: '011', col: 0, row: 0, w: 1, h: 1 }, // RotaryDimmer
      { id: '012', col: 0, row: 1, w: 1, h: 1 }, // RedFader
      { id: '013', col: 0, row: 2, w: 1, h: 1 }, // GreenFader

      { id: '014', col: 1, row: 0, w: 1, h: 1 }, // BlueFader
      { id: '015', col: 1, row: 1, w: 1, h: 1 }, // RainbowCrossfader
      { id: '018', col: 1, row: 2, w: 1, h: 1 }, // HaloExpander

      { id: '012b', col: 2, row: 0, w: 1, h: 2 }, // RGBCanvasBlock (Double height)
      { id: '017', col: 2, row: 2, w: 1, h: 1 }, // StrobeFrequency

      { id: '016', col: 3, row: 0, w: 1, h: 2 }, // ShadowProjection (Double height)
      { id: '019', col: 3, row: 2, w: 1, h: 1 }, // ContrastInverter

      { id: '020', col: 4, row: 0, w: 1, h: 2 }, // DualFingerGradient (Double height)
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
        this // Pass 'this' as the parent controller game
      );
      instance.init();
      this.modules.push(instance);
    });
  }

  public getTheme(): 'paper' | 'neon' {
    return this.theme;
  }

  public setTheme(newTheme: 'paper' | 'neon') {
    this.theme = newTheme;
  }

  public getRGB() {
    return this.rgb;
  }

  public updateRGB(channel: 'r' | 'g' | 'b', val: number) {
    this.rgb[channel] = val;
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

    // Draw main background color based on active theme
    if (this.theme === 'paper') {
      this.ctx.fillStyle = '#FAF4E8'; // Warm parchment
    } else {
      this.ctx.fillStyle = '#0C0E14'; // Cyber dark
    }
    this.ctx.fillRect(0, 0, boardWidth, this.canvas.height);

    // Draw gorgeous glowing background auris/halo representing active RGB color mix
    const mixR = Math.round(this.rgb.r * 255);
    const mixG = Math.round(this.rgb.g * 255);
    const mixB = Math.round(this.rgb.b * 255);
    const mixColor = `rgb(${mixR}, ${mixG}, ${mixB})`;

    this.ctx.save();
    // Ambient radial glow behind modules
    const radGlow = this.ctx.createRadialGradient(
      boardWidth / 2, this.canvas.height / 2, 50,
      boardWidth / 2, this.canvas.height / 2, boardWidth * 0.4
    );
    radGlow.addColorStop(0, `rgba(${mixR}, ${mixG}, ${mixB}, ${this.theme === 'paper' ? 0.08 : 0.18})`);
    radGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = radGlow;
    this.ctx.fillRect(0, 0, boardWidth, this.canvas.height);
    this.ctx.restore();

    // Draw module grid dividing lines
    if (this.theme === 'paper') {
      this.ctx.strokeStyle = '#E3D7C1';
    } else {
      this.ctx.strokeStyle = '#1D2530';
    }
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

    const arrowColor = this.theme === 'paper' ? 'rgba(90, 86, 76, 0.4)' : 'rgba(0, 255, 204, 0.4)';
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
