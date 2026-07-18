import type { Game } from '../../core/Game';
import type { BusyBoardModule } from './BusyBoardModule';
import { BoardModuleRegistry } from './BoardModuleRegistry';
import { AudioController } from '../../core/AudioController';

export class SwitchboardGame implements Game {
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

  // Shake effect state
  private shakeDuration = 0; // remaining shake time in ms
  private shakeIntensity = 0;
  private shakeX = 0;
  private shakeY = 0;

  // Global power state
  private hasPower = true;

  constructor() {}

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Register high-fidelity mechanical click/clack sounds
    const audio = AudioController.getInstance();
    audio.registerSound('busyboard:arcade_button', '/sounds/busyBoard/arcade_button.wav');
    audio.registerSound('busyboard:breaker_flip', '/sounds/busyBoard/breaker_flip.wav');
    audio.registerSound('busyboard:dip', '/sounds/busyBoard/dip.wav');
    audio.registerSound('busyboard:key_turn', '/sounds/busyBoard/key_turn.wav');
    audio.registerSound('busyboard:knife_close', '/sounds/busyBoard/knife_close.wav');
    audio.registerSound('busyboard:knife_open', '/sounds/busyBoard/knife_open.wav');
    audio.registerSound('busyboard:pedal_thud', '/sounds/busyBoard/pedal_thud.wav');
    audio.registerSound('busyboard:pull_cord', '/sounds/busyBoard/pull_cord.wav');
    audio.registerSound('busyboard:push_button', '/sounds/busyBoard/push_button.wav');
    audio.registerSound('busyboard:rocker_off', '/sounds/busyBoard/rocker_off.wav');
    audio.registerSound('busyboard:rocker_on', '/sounds/busyBoard/rocker_on.wav');
    audio.registerSound('busyboard:toggle_off', '/sounds/busyBoard/toggle_off.wav');
    audio.registerSound('busyboard:toggle_on', '/sounds/busyBoard/toggle_on.wav');

    this.setupLayout();
    this.setupModules();

    // Event listeners
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);

    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  private setupLayout() {
    if (!this.canvas) return;
    this.cols = 4;
    this.rows = 3;

    // Minimum column width of 300px prevents modules from getting squished on narrow viewports
    this.cellW = Math.max(300, this.canvas.width / this.cols);
    this.cellH = this.canvas.height / this.rows;

    const boardWidth = this.cols * this.cellW;
    this.maxScrollX = Math.max(0, boardWidth - this.canvas.width);
    this.scrollX = Math.min(this.scrollX, this.maxScrollX);
  }

  private setupModules() {
    this.modules = [];

    // Define coordinates in grid cells [col, row, width, height]
    const layouts = [
      { id: '010', col: 0, row: 0, w: 1, h: 2 }, // BreakerLever (Double-height)
      { id: '006', col: 0, row: 2, w: 1, h: 1 }, // PushLatchButton
      
      { id: '001', col: 1, row: 0, w: 1, h: 1 }, // RockerSwitch
      { id: '002', col: 1, row: 1, w: 1, h: 1 }, // IndustrialToggle
      { id: '003', col: 1, row: 2, w: 1, h: 1 }, // KnifeSwitch

      { id: '004', col: 2, row: 0, w: 1, h: 1 }, // DIPArray
      { id: '005', col: 2, row: 1, w: 1, h: 1 }, // PullStringCord
      { id: '007', col: 2, row: 2, w: 1, h: 1 }, // KeyRotation

      { id: '009', col: 3, row: 0, w: 1, h: 2 }, // HeavyPedal (Double-height)
      { id: '008', col: 3, row: 2, w: 1, h: 1 }, // ArcadeDome
    ];

    layouts.forEach(layout => {
      const Constructor = BoardModuleRegistry[layout.id];
      if (!Constructor) {
        console.warn(`Module constructor for ID ${layout.id} not found.`);
        return;
      }

      // Add callbacks depending on module type
      let callback: any = undefined;
      if (layout.id === '010') {
        // Breaker Lever controls power state of all other modules
        callback = (hasPower: boolean) => this.setPowerState(hasPower);
      } else if (layout.id === '009') {
        // Heavy pedal triggers screen shake
        callback = () => this.triggerShake(400, 8);
      }

      const instance = new Constructor(
        layout.id,
        layout.col,
        layout.row,
        layout.w,
        layout.h,
        callback
      );
      instance.init();
      this.modules.push(instance);
    });
  }

  private setPowerState(hasPower: boolean) {
    this.hasPower = hasPower;
    this.modules.forEach(mod => {
      if (mod.id !== '010' && mod.setPowerState) {
        mod.setPowerState(hasPower);
      }
    });
  }

  private triggerShake(durationMs: number, intensity: number) {
    this.shakeDuration = durationMs;
    this.shakeIntensity = intensity;
  }

  public update(dt: number): void {
    // Check if heavy pedal is pressed to continue screen shake
    const pedal = this.modules.find(m => m.id === '009') as any;
    if (pedal && pedal.isPressed) {
      this.shakeDuration = 100;
      this.shakeIntensity = 8;
    }

    // Process screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeX = 0;
        this.shakeY = 0;
      } else {
        this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }
    }

    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctxSaveAndApplyShake(this.ctx, this.shakeX, this.shakeY);

    // Apply horizontal translation for scrolling
    this.ctx.save();
    this.ctx.translate(-this.scrollX, 0);

    const boardWidth = this.cols * this.cellW;

    // Draw grid background texture (Parchment/wooden board style borders)
    this.ctx.fillStyle = '#E3D7C1'; // Darker background behind modules
    this.ctx.fillRect(0, 0, boardWidth, this.canvas.height);

    // Draw module grid dividing lines
    this.ctx.strokeStyle = '#C4B599';
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

    this.ctx.restore(); // Restore translation

    // Draw visual hints if the board can scroll
    this.drawScrollIndicators();

    this.ctx.restore(); // Restore shake translation
  }

  private drawScrollIndicators() {
    if (!this.ctx || !this.canvas) return;

    const arrowColor = 'rgba(43, 45, 94, 0.4)';
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
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.processPointerMove(x, y);
  }

  private handleMouseUp = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.processPointerUp(x, y);
  }

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerDown(x, y);
  }

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerMove(x, y);
  }

  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.processPointerUp(x, y);
  }

  private processPointerDown(x: number, y: number) {
    this.activeDragModule = null;
    this.isPanning = false;

    const worldX = x + this.scrollX;

    for (let i = 0; i < this.modules.length; i++) {
      const mod = this.modules[i];
      const box = this.getModuleRenderBox(mod);

      // Call handlePointerDown and remember active dragging element
      if (mod.handlePointerDown(worldX, y, box.x, box.y, box.w, box.h)) {
        this.activeDragModule = mod;
        break;
      }
    }

    // Start panning if we did not hit any module and board is scrollable
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

function ctxSaveAndApplyShake(ctx: CanvasRenderingContext2D, shakeX: number, shakeY: number) {
  ctx.save();
  if (shakeX !== 0 || shakeY !== 0) {
    ctx.translate(shakeX, shakeY);
  }
}
