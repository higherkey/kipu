import { BaseGame } from '../../core/BaseGame';
import { TranslationManager } from '../../core/TranslationManager';

type PaintToolId = 'red' | 'yellow' | 'blue' | 'white' | 'black' | 'finger';

interface PaintWell {
  id: PaintToolId;
  colorHex: string | null; // null for finger/smudge
  labelKey: string;
  x: number;
  width: number;
}

const COLOR_MAP: Record<string, string> = {
  red: '#FF3B30',
  yellow: '#FFCC00',
  blue: '#007AFF',
  white: '#FFFFFF',
  black: '#1C1C1E',
};

const PALETTE_NAMES: Record<string, Record<string, string>> = {
  en: { red: 'Red', yellow: 'Yellow', blue: 'Blue', white: 'White', black: 'Black', finger: 'Smudge' },
  es: { red: 'Rojo', yellow: 'Amarillo', blue: 'Azul', white: 'Blanco', black: 'Negro', finger: 'Dedo' },
  fr: { red: 'Rouge', yellow: 'Jaune', blue: 'Bleu', white: 'Blanc', black: 'Noir', finger: 'Doigt' },
  de: { red: 'Rot', yellow: 'Gelb', blue: 'Blau', white: 'Weiß', black: 'Schwarz', finger: 'Finger' },
  it: { red: 'Rosso', yellow: 'Giallo', blue: 'Blu', white: 'Bianco', black: 'Nero', finger: 'Dito' },
  pt: { red: 'Vermelho', yellow: 'Amarelo', blue: 'Azul', white: 'Branco', black: 'Preto', finger: 'Dedo' },
  ja: { red: '赤', yellow: '黄色', blue: '青', white: '白', black: '黒', finger: '指' },
  ko: { red: '빨강', yellow: '노랑', blue: '파랑', white: '하양', black: '검정', finger: '손가락' },
  zh: { red: '红色', yellow: '黄色', blue: '蓝色', white: '白色', black: '黑色', finger: '涂抹' },
  ru: { red: 'Красный', yellow: 'Желтый', blue: 'Синий', white: 'Белый', black: 'Черный', finger: 'Палец' }
};

export class ColorMixerGame extends BaseGame {
  // Window-level release handlers to eliminate sticky smear when pointer exits canvas bounds
  private boundWindowMouseUp: (() => void) | null = null;
  private boundWindowTouchCancel: (() => void) | null = null;
  private boundWindowBlur: (() => void) | null = null;

  // Offscreen paint buffer canvas
  private bufferCanvas: HTMLCanvasElement | null = null;
  private bufferCtx: CanvasRenderingContext2D | null = null;

  // Secondary scratch canvas to eliminate self-blit GPU hazard/black square artifacts
  private scratchCanvas: HTMLCanvasElement | null = null;
  private scratchCtx: CanvasRenderingContext2D | null = null;

  // Active Tool Selection
  private activeTool: PaintToolId = 'red';

  // Smudge Drag History & Brush Configuration
  private isDrawing = false;
  private lastPos = { x: 0, y: 0 };
  private readonly brushRadius = 26;
  private audioThrottleTime = 0;

  // UI Palette details
  private readonly potsY = 20;
  private readonly potsHeight = 70;
  private wells: PaintWell[] = [];

  constructor() {
    super();
    // Register audio cues to prevent silence on direct navigation
    this.audio.registerSound('bloop', '/sounds/pop.ogg');
    this.audio.registerSound('pop', '/sounds/pop.ogg');
  }

  protected onInit(): void {
    if (!this.canvas) return;

    // Setup primary paint buffer canvas
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.canvas.width;
    this.bufferCanvas.height = this.canvas.height;
    this.bufferCtx = this.bufferCanvas.getContext('2d');

    // Setup dedicated scratch buffer (2 * brushRadius) for safe transfer blits
    const scratchSize = this.brushRadius * 2;
    this.scratchCanvas = document.createElement('canvas');
    this.scratchCanvas.width = scratchSize;
    this.scratchCanvas.height = scratchSize;
    this.scratchCtx = this.scratchCanvas.getContext('2d');
    
    // Clear paint layer to parchment color
    if (this.bufferCtx) {
      this.bufferCtx.fillStyle = '#F4ECD8';
      this.bufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.setupWells();

    // Canvas-level pointer & touch listeners
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);

    // Window-level release handlers: guarantee drawing state resets when cursor/finger leaves canvas
    this.boundWindowMouseUp = () => { this.endPress(); };
    this.boundWindowTouchCancel = () => { this.endPress(); };
    this.boundWindowBlur = () => { this.endPress(); };
    window.addEventListener('mouseup', this.boundWindowMouseUp);
    window.addEventListener('touchend', this.boundWindowMouseUp);
    window.addEventListener('touchcancel', this.boundWindowTouchCancel);
    window.addEventListener('blur', this.boundWindowBlur);
  }

  private setupWells() {
    if (!this.canvas) return;
    const width = this.canvas.width;
    const toolIds: Array<'red' | 'yellow' | 'blue' | 'white' | 'black' | 'finger'> = [
      'red', 'yellow', 'blue', 'white', 'black', 'finger'
    ];
    
    const wellCount = toolIds.length;
    // Account for clear button on far right, leave some margins
    const usableWidth = width - 90;
    const wellWidth = Math.min(52, usableWidth / (wellCount + 1));
    const spacing = (usableWidth - wellWidth * wellCount) / (wellCount + 1);

    this.wells = toolIds.map((id, index) => {
      return {
        id,
        colorHex: id === 'finger' ? null : COLOR_MAP[id],
        labelKey: id,
        x: spacing + index * (wellWidth + spacing) + 10,
        width: wellWidth
      };
    });
  }

  private getLanguage(): string {
    const code = TranslationManager.getCurrent().code;
    return code.split('-')[0];
  }

  private getToolName(key: string): string {
    const lang = this.getLanguage();
    const dict = PALETTE_NAMES[lang] || PALETTE_NAMES.en;
    return dict[key] || key;
  }

  private readonly handleMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.startPress(pos.x, pos.y);
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    if (!this.isDrawing) return;
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.movePress(pos.x, pos.y);
  };

  private readonly handleMouseUp = () => {
    this.endPress();
  };

  private readonly handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.startPress(pos.x, pos.y);
  };

  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.isDrawing) return;
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.movePress(pos.x, pos.y);
  };

  private readonly handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    this.endPress();
  };

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private startPress(x: number, y: number) {
    // Check if clicked in paint wells area
    if (y >= this.potsY && y <= this.potsY + this.potsHeight) {
      for (const well of this.wells) {
        if (x >= well.x && x <= well.x + well.width) {
          this.activeTool = well.id;
          this.audio.play('bloop');
          this.haptics.lightTap();
          
          // Announce tool name
          const langCode = TranslationManager.getCurrent().code;
          const label = this.getToolName(well.id);
          this.audio.speak(label, langCode);
          return;
        }
      }
    }

    // Check if clicked in clear button area (far right top)
    if (this.canvas && x > this.canvas.width - 70 && y < 65) {
      this.clearAll();
      return;
    }

    // Otherwise, start drawing/smudging below the palette header line
    const headerLineY = this.potsY + this.potsHeight + 15;
    if (y > headerLineY) {
      this.isDrawing = true;
      this.lastPos = { x, y };

      // Spawn initial drop if a color tool is selected
      if (this.activeTool !== 'finger') {
        this.paintDrop(x, y, COLOR_MAP[this.activeTool]);
      } else {
        // Just trigger finger smudge sound/haptic
        this.audio.play('synth:pluck', 100);
        this.haptics.lightTap();
      }
    }
  }

  private movePress(x: number, y: number) {
    const headerLineY = this.potsY + this.potsHeight + 15;
    const clampedY = Math.max(headerLineY + this.brushRadius, y);
    const clampedX = Math.max(this.brushRadius, Math.min(this.canvas!.width - this.brushRadius, x));

    this.smudgeLine(this.lastPos.x, this.lastPos.y, clampedX, clampedY);
    this.lastPos = { x: clampedX, y: clampedY };
  }

  private endPress() {
    this.isDrawing = false;
  }

  private paintDrop(x: number, y: number, colorHex: string) {
    if (!this.bufferCtx) return;

    const radius = 25 + Math.random() * 8;
    const grad = this.bufferCtx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.82, colorHex);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    this.bufferCtx.save();
    this.bufferCtx.fillStyle = grad;
    this.bufferCtx.beginPath();
    this.bufferCtx.arc(x, y, radius, 0, Math.PI * 2);
    this.bufferCtx.fill();
    this.bufferCtx.restore();

    this.audio.play('bloop');
    this.haptics.lightTap();
  }

  private smudgeLine(x1: number, y1: number, x2: number, y2: number) {
    if (!this.bufferCtx || !this.bufferCanvas) return;

    const dist = Math.hypot(x2 - x1, y2 - y1);
    // Smooth step spacing with a protective upper bound to prevent frame drops on fast swipes
    const steps = Math.max(1, Math.min(50, Math.floor(dist / 6)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      // Compute the interpolated previous position for this step
      const tPrev = Math.max(0, (i - 1) / steps);
      const prevSx = x1 + (x2 - x1) * tPrev;
      const prevSy = y1 + (y2 - y1) * tPrev;

      this.smudgeAtPoint(sx, sy, prevSx, prevSy);
    }

    // Play subtle audio and haptic feedback throttled during smearing
    const now = performance.now();
    if (now - this.audioThrottleTime > 90) {
      const speedNote = Math.min(180, 70 + Math.floor(dist * 2));
      this.audio.play('synth:click', speedNote);
      this.haptics.lightTap();
      this.audioThrottleTime = now;
    }
  }

  /**
   * Smudges paint at a point using an intermediate scratch canvas.
   * This completely prevents WebKit GPU self-blit synchronization stalls and black-square artifacts.
   */
  private smudgeAtPoint(x: number, y: number, prevX: number, prevY: number) {
    if (!this.bufferCtx || !this.bufferCanvas || !this.scratchCanvas || !this.scratchCtx) return;

    const r = this.brushRadius;
    const size = r * 2;

    // Calculate source bounds clamped to buffer canvas dimensions
    const rawSrcX = x - r - (x - prevX) * 0.4;
    const rawSrcY = y - r - (y - prevY) * 0.4;
    const srcX = Math.max(0, Math.min(this.bufferCanvas.width - size, rawSrcX));
    const srcY = Math.max(0, Math.min(this.bufferCanvas.height - size, rawSrcY));
    const dstX = x - r;
    const dstY = y - r;

    // Step 1: Copy patch from bufferCanvas into scratchCanvas (separate textures: safe)
    this.scratchCtx.clearRect(0, 0, size, size);
    this.scratchCtx.drawImage(
      this.bufferCanvas,
      srcX, srcY, size, size,
      0, 0, size, size
    );

    // Step 2: Draw scratchCanvas back into bufferCanvas with circular clip & slight opacity
    this.bufferCtx.save();
    this.bufferCtx.beginPath();
    this.bufferCtx.arc(x, y, r, 0, Math.PI * 2);
    this.bufferCtx.clip();

    this.bufferCtx.globalAlpha = 0.91;
    this.bufferCtx.drawImage(
      this.scratchCanvas,
      0, 0, size, size,
      dstX, dstY, size, size
    );

    this.bufferCtx.restore();

    // If active color tool is selected, blend in a small amount of fresh pigment
    if (this.activeTool !== 'finger') {
      const colorHex = COLOR_MAP[this.activeTool];
      const colorGrad = this.bufferCtx.createRadialGradient(x, y, r * 0.05, x, y, r);
      colorGrad.addColorStop(0, colorHex);
      colorGrad.addColorStop(0.8, colorHex);
      colorGrad.addColorStop(1, 'rgba(0,0,0,0)');

      this.bufferCtx.save();
      this.bufferCtx.globalAlpha = 0.07; // Very low opacity overlay
      this.bufferCtx.fillStyle = colorGrad;
      this.bufferCtx.beginPath();
      this.bufferCtx.arc(x, y, r, 0, Math.PI * 2);
      this.bufferCtx.fill();
      this.bufferCtx.restore();
    }
  }

  private clearAll() {
    if (this.bufferCtx && this.canvas) {
      this.bufferCtx.fillStyle = '#F4ECD8';
      this.bufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.audio.play('pop');
      this.haptics.lightTap();
    }
  }

  update(_dt: number): void {
    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas || !this.bufferCanvas) return;

    // Draw the paint buffer onto the screen
    this.ctx.drawImage(this.bufferCanvas, 0, 0);

    // Draw header palette separator line
    this.ctx.strokeStyle = '#D4B896';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.potsY + this.potsHeight + 15);
    this.ctx.lineTo(this.canvas.width, this.potsY + this.potsHeight + 15);
    this.ctx.stroke();

    // Draw ceramic wells
    this.wells.forEach(well => {
      const isSelected = this.activeTool === well.id;

      // Draw shadow well backplate
      this.ctx!.fillStyle = 'rgba(43, 45, 94, 0.08)';
      this.ctx!.beginPath();
      this.ctx!.arc(well.x + well.width / 2, this.potsY + this.potsHeight / 2 + 3, well.width / 2, 0, Math.PI * 2);
      this.ctx!.fill();

      // Outer Ceramic Ring
      this.ctx!.fillStyle = '#ffffff';
      this.ctx!.strokeStyle = isSelected ? '#3498DB' : '#2B2D5E';
      this.ctx!.lineWidth = isSelected ? 4 : 3;
      this.ctx!.beginPath();
      this.ctx!.arc(well.x + well.width / 2, this.potsY + this.potsHeight / 2, well.width / 2, 0, Math.PI * 2);
      this.ctx!.fill();
      this.ctx!.stroke();

      if (well.id === 'finger') {
        // Draw finger smudge icon inside well
        this.ctx!.fillStyle = '#2B2D5E';
        this.ctx!.font = 'bold 18px Fredoka, sans-serif';
        this.ctx!.textAlign = 'center';
        this.ctx!.textBaseline = 'middle';
        this.ctx!.fillText('☝', well.x + well.width / 2, this.potsY + this.potsHeight / 2);
      } else if (well.colorHex) {
        // Draw color paint inside well
        this.ctx!.fillStyle = well.colorHex;
        this.ctx!.beginPath();
        this.ctx!.arc(well.x + well.width / 2, this.potsY + this.potsHeight / 2, well.width / 2 - 7, 0, Math.PI * 2);
        this.ctx!.fill();
      }

      // Selection Ring indicators
      if (isSelected) {
        this.ctx!.strokeStyle = '#3498DB';
        this.ctx!.lineWidth = 2;
        this.ctx!.beginPath();
        this.ctx!.arc(well.x + well.width / 2, this.potsY + this.potsHeight / 2, well.width / 2 + 5, 0, Math.PI * 2);
        this.ctx!.stroke();
      }

      // Labels below wells
      this.ctx!.fillStyle = '#2B2D5E';
      this.ctx!.font = 'bold 10px Fredoka, sans-serif';
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'top';
      this.ctx!.fillText(
        this.getToolName(well.id).toUpperCase(),
        well.x + well.width / 2,
        this.potsY + this.potsHeight - 6
      );
    });

    // Clear (✕) Button
    const rx = this.canvas.width - 50;
    const ry = this.potsY + this.potsHeight / 2;
    this.ctx.fillStyle = '#C0392B';
    this.ctx.strokeStyle = '#2B2D5E';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(rx, ry, 17, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('✕', rx, ry + 1);

    // Tip Banner Text
    this.ctx.fillStyle = 'rgba(43, 45, 94, 0.45)';
    this.ctx.font = '500 13px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Choose color to place drops • Drag finger to smear & mix!', this.canvas.width / 2, this.potsY + this.potsHeight + 25);
  }



  /**
   * Resizes the canvas while preserving existing painted artwork.
   * Re-calibrates well positions for the new width.
   */
  public resize(width: number, height: number): void {
    if (!this.bufferCanvas || !this.bufferCtx || width <= 0 || height <= 0) return;

    // Snapshot existing artwork onto temporary offscreen canvas
    const temp = document.createElement('canvas');
    temp.width = this.bufferCanvas.width;
    temp.height = this.bufferCanvas.height;
    const tempCtx = temp.getContext('2d');
    tempCtx?.drawImage(this.bufferCanvas, 0, 0);

    // Resize primary buffer canvas (clears context)
    this.bufferCanvas.width = width;
    this.bufferCanvas.height = height;

    // Re-fill parchment background and blit preserved artwork 1:1
    this.bufferCtx.fillStyle = '#F4ECD8';
    this.bufferCtx.fillRect(0, 0, width, height);
    this.bufferCtx.drawImage(temp, 0, 0);

    // Re-calculate paint wells for new canvas width
    this.setupWells();
  }

  destroy(): void {
    window.speechSynthesis?.cancel();
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    }
    if (this.boundWindowMouseUp) {
      window.removeEventListener('mouseup', this.boundWindowMouseUp);
      window.removeEventListener('touchend', this.boundWindowMouseUp);
      this.boundWindowMouseUp = null;
    }
    if (this.boundWindowTouchCancel) {
      window.removeEventListener('touchcancel', this.boundWindowTouchCancel);
      this.boundWindowTouchCancel = null;
    }
    if (this.boundWindowBlur) {
      window.removeEventListener('blur', this.boundWindowBlur);
      this.boundWindowBlur = null;
    }
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.scratchCanvas = null;
    this.scratchCtx = null;
  }
}
