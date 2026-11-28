import { BaseGame } from '../../core/BaseGame';
import { TranslationManager } from '../../core/TranslationManager';
import { floodFill, hexToRgb } from './floodFill';

type ColorId = 'red' | 'yellow' | 'blue' | 'white' | 'black';
type BrushId = 'smudge' | 'brush' | 'spray' | 'dots' | 'fill';

interface PaintWell {
  id: ColorId;
  colorHex: string;
  labelKey: string;
  x: number;
  width: number;
}

interface BrushButton {
  id: BrushId;
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLOR_IDS: ColorId[] = ['red', 'yellow', 'blue', 'white', 'black'];
const BRUSH_IDS: BrushId[] = ['smudge', 'brush', 'spray', 'dots', 'fill'];

const COLOR_MAP: Record<ColorId, string> = {
  red: '#FF3B30',
  yellow: '#FFCC00',
  blue: '#007AFF',
  white: '#FFFFFF',
  black: '#1C1C1E',
};

const INK = '#2B2D5E';
const PARCHMENT = '#F4ECD8';

const PALETTE_NAMES: Record<string, Record<string, string>> = {
  en: { red: 'Red', yellow: 'Yellow', blue: 'Blue', white: 'White', black: 'Black' },
  es: { red: 'Rojo', yellow: 'Amarillo', blue: 'Azul', white: 'Blanco', black: 'Negro' },
  fr: { red: 'Rouge', yellow: 'Jaune', blue: 'Bleu', white: 'Blanc', black: 'Noir' },
  de: { red: 'Rot', yellow: 'Gelb', blue: 'Blau', white: 'Weiß', black: 'Schwarz' },
  it: { red: 'Rosso', yellow: 'Giallo', blue: 'Blu', white: 'Bianco', black: 'Nero' },
  pt: { red: 'Vermelho', yellow: 'Amarelo', blue: 'Azul', white: 'Branco', black: 'Preto' },
  ja: { red: '赤', yellow: '黄色', blue: '青', white: '白', black: '黒' },
  ko: { red: '빨강', yellow: '노랑', blue: '파랑', white: '하양', black: '검정' },
  zh: { red: '红色', yellow: '黄色', blue: '蓝色', white: '白色', black: '黑色' },
  ru: { red: 'Красный', yellow: 'Желтый', blue: 'Синий', white: 'Белый', black: 'Черный' }
};

const BRUSH_NAMES: Record<string, Record<BrushId, string>> = {
  en: { smudge: 'Smudge', brush: 'Brush', spray: 'Spray', dots: 'Dots', fill: 'Fill' },
  es: { smudge: 'Dedo', brush: 'Pincel', spray: 'Spray', dots: 'Puntos', fill: 'Llenar' },
  fr: { smudge: 'Doigt', brush: 'Pinceau', spray: 'Spray', dots: 'Points', fill: 'Remplir' },
  de: { smudge: 'Finger', brush: 'Pinsel', spray: 'Spray', dots: 'Punkte', fill: 'Füllen' },
  it: { smudge: 'Dito', brush: 'Pennello', spray: 'Spray', dots: 'Puntini', fill: 'Riempi' },
  pt: { smudge: 'Dedo', brush: 'Pincel', spray: 'Spray', dots: 'Bolinhas', fill: 'Encher' },
  ja: { smudge: '指', brush: '筆', spray: 'スプレー', dots: '水玉', fill: 'ぬりつぶし' },
  ko: { smudge: '손가락', brush: '붓', spray: '스프레이', dots: '점', fill: '채우기' },
  zh: { smudge: '涂抹', brush: '画笔', spray: '喷枪', dots: '圆点', fill: '填充' },
  ru: { smudge: 'Палец', brush: 'Кисть', spray: 'Спрей', dots: 'Точки', fill: 'Заливка' }
};

// Fixed spray icon pattern so the tray does not flicker each frame
const SPRAY_ICON_DOTS: Array<[number, number]> = [
  [0, 0], [-6, -4], [5, -6], [7, 3], [-4, 6], [1, -11], [-11, 1], [11, -2],
  [-8, -9], [9, 9], [-2, 12], [13, -9], [-13, 8], [4, 7], [-6, -12], [12, 6]
];

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

  // Active colour and brush (picked separately)
  private activeColor: ColorId = 'red';
  private activeBrush: BrushId = 'brush';

  // Drag state & brush configuration
  private isDrawing = false;
  private lastPos = { x: 0, y: 0 };
  private readonly brushRadius = 26; // smudge radius
  private readonly solidRadius = 16; // round brush
  private readonly sprayRadius = 34;
  private readonly dotSpacing = 40;
  private distanceSinceDot = 0;
  private lastDotSoundTime = 0;
  private audioThrottleTime = 0;

  // UI palette details
  private readonly potsY = 20;
  private readonly potsHeight = 70;
  private readonly trayHeight = 84;
  private wells: PaintWell[] = [];
  private brushes: BrushButton[] = [];

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
    this.bufferCtx = this.bufferCanvas.getContext('2d', { willReadFrequently: true });

    // Setup dedicated scratch buffer (2 * brushRadius) for safe transfer blits
    const scratchSize = this.brushRadius * 2;
    this.scratchCanvas = document.createElement('canvas');
    this.scratchCanvas.width = scratchSize;
    this.scratchCanvas.height = scratchSize;
    this.scratchCtx = this.scratchCanvas.getContext('2d');

    // Clear paint layer to parchment color
    if (this.bufferCtx) {
      this.bufferCtx.fillStyle = PARCHMENT;
      this.bufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.setupWells();
    this.setupBrushes();

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

  // ---------------------------------------------------------------- layout

  private get headerLineY(): number {
    return this.potsY + this.potsHeight + 15;
  }

  private get trayTop(): number {
    return (this.canvas?.height ?? 0) - this.trayHeight;
  }

  private setupWells() {
    if (!this.canvas) return;
    const width = this.canvas.width;
    const wellCount = COLOR_IDS.length;
    // Account for clear button on far right, leave some margins
    const usableWidth = width - 90;
    const wellWidth = Math.min(52, usableWidth / (wellCount + 1));
    const spacing = (usableWidth - wellWidth * wellCount) / (wellCount + 1);

    this.wells = COLOR_IDS.map((id, index) => ({
      id,
      colorHex: COLOR_MAP[id],
      labelKey: id,
      x: spacing + index * (wellWidth + spacing) + 10,
      width: wellWidth
    }));
  }

  private setupBrushes() {
    if (!this.canvas) return;
    const count = BRUSH_IDS.length;
    const gap = 10;
    const btnW = Math.max(48, Math.min(76, (this.canvas.width - 24 - gap * (count - 1)) / count));
    const btnH = 64;
    const total = btnW * count + gap * (count - 1);
    const startX = (this.canvas.width - total) / 2;
    const y = this.trayTop + (this.trayHeight - btnH) / 2 + 2;

    this.brushes = BRUSH_IDS.map((id, index) => ({
      id,
      x: startX + index * (btnW + gap),
      y,
      width: btnW,
      height: btnH
    }));
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

  private getBrushName(id: BrushId): string {
    const lang = this.getLanguage();
    const dict = BRUSH_NAMES[lang] || BRUSH_NAMES.en;
    return dict[id] || BRUSH_NAMES.en[id];
  }

  // ---------------------------------------------------------------- input

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
    // Paint pots along the top
    if (y >= this.potsY && y <= this.potsY + this.potsHeight) {
      for (const well of this.wells) {
        if (x >= well.x && x <= well.x + well.width) {
          this.selectColor(well.id);
          return;
        }
      }
    }

    // Clear button (far right top)
    if (this.canvas && x > this.canvas.width - 70 && y < 65) {
      this.clearAll();
      return;
    }

    // Brush tray along the bottom
    if (y >= this.trayTop) {
      for (const btn of this.brushes) {
        if (x >= btn.x && x <= btn.x + btn.width) {
          this.selectBrush(btn.id);
          return;
        }
      }
      return;
    }

    // Otherwise paint, between the pots and the tray
    if (y <= this.headerLineY) return;

    this.lastPos = { x, y };
    this.distanceSinceDot = 0;

    switch (this.activeBrush) {
      case 'smudge':
        this.isDrawing = true;
        this.audio.play('synth:pluck', 100);
        this.haptics.lightTap();
        break;
      case 'brush':
        this.isDrawing = true;
        this.paintStroke(x, y, x, y);
        this.audio.play('bloop');
        this.haptics.lightTap();
        break;
      case 'spray':
        this.isDrawing = true;
        this.sprayAt(x, y, 40);
        this.audio.play('synth:click', 160);
        this.haptics.lightTap();
        break;
      case 'dots':
        this.isDrawing = true;
        this.placeDot(x, y);
        break;
      case 'fill':
        this.bucketFill(x, y);
        break;
    }
  }

  private selectColor(id: ColorId) {
    this.activeColor = id;
    // Smudge carries no colour: picking a colour means the child wants to paint with it
    if (this.activeBrush === 'smudge') this.activeBrush = 'brush';
    this.audio.play('bloop');
    this.haptics.lightTap();
    this.audio.speak(this.getToolName(id), TranslationManager.getCurrent().code);
  }

  private selectBrush(id: BrushId) {
    this.activeBrush = id;
    this.audio.play('bloop');
    this.haptics.lightTap();
    this.audio.speak(this.getBrushName(id), TranslationManager.getCurrent().code);
  }

  private movePress(x: number, y: number) {
    if (!this.canvas) return;
    const top = this.headerLineY;
    const bottom = this.trayTop;

    if (this.activeBrush === 'smudge') {
      const r = this.brushRadius;
      const clampedY = Math.max(top + r, Math.min(bottom - r, y));
      const clampedX = Math.max(r, Math.min(this.canvas.width - r, x));
      this.smudgeLine(this.lastPos.x, this.lastPos.y, clampedX, clampedY);
      this.lastPos = { x: clampedX, y: clampedY };
      return;
    }

    const cx = Math.max(0, Math.min(this.canvas.width, x));
    const cy = Math.max(top, Math.min(bottom, y));
    const dist = Math.hypot(cx - this.lastPos.x, cy - this.lastPos.y);

    if (this.activeBrush === 'brush') {
      this.paintStroke(this.lastPos.x, this.lastPos.y, cx, cy);
      this.dragFeedback(dist);
    } else if (this.activeBrush === 'spray') {
      const steps = Math.max(1, Math.min(30, Math.floor(dist / 8)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.sprayAt(
          this.lastPos.x + (cx - this.lastPos.x) * t,
          this.lastPos.y + (cy - this.lastPos.y) * t,
          16
        );
      }
    } else if (this.activeBrush === 'dots') {
      // Lay a dot every `dotSpacing` pixels along the path
      let remaining = dist;
      let fromX = this.lastPos.x;
      let fromY = this.lastPos.y;
      while (this.distanceSinceDot + remaining >= this.dotSpacing) {
        const need = this.dotSpacing - this.distanceSinceDot;
        const t = need / remaining;
        fromX += (cx - fromX) * t;
        fromY += (cy - fromY) * t;
        remaining -= need;
        this.distanceSinceDot = 0;
        this.placeDot(fromX, fromY);
      }
      this.distanceSinceDot += remaining;
    }

    this.lastPos = { x: cx, y: cy };
  }

  private endPress() {
    this.isDrawing = false;
  }

  private dragFeedback(dist: number) {
    const now = performance.now();
    if (now - this.audioThrottleTime > 90) {
      const speedNote = Math.min(180, 70 + Math.floor(dist * 2));
      this.audio.play('synth:click', speedNote);
      this.haptics.lightTap();
      this.audioThrottleTime = now;
    }
  }

  // ---------------------------------------------------------------- brushes

  /** Restricts paint to the space between the pots and the brush tray. */
  private clipToPaintArea(ctx: CanvasRenderingContext2D) {
    if (!this.canvas) return;
    const top = this.headerLineY;
    const bottom = this.trayTop;
    const w = this.canvas.width;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(w, top);
    ctx.lineTo(w, bottom);
    ctx.lineTo(0, bottom);
    ctx.lineTo(0, top);
    ctx.clip();
  }

  /** Solid round brush: a thick line with round ends, full colour. */
  private paintStroke(x1: number, y1: number, x2: number, y2: number) {
    const ctx = this.bufferCtx;
    if (!ctx) return;
    const colorHex = COLOR_MAP[this.activeColor];

    ctx.save();
    this.clipToPaintArea(ctx);
    ctx.fillStyle = colorHex;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = this.solidRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (x1 === x2 && y1 === y2) {
      ctx.beginPath();
      ctx.arc(x1, y1, this.solidRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Airbrush: a soft cloud of fine specks, thicker in the middle. */
  private sprayAt(x: number, y: number, count: number) {
    const ctx = this.bufferCtx;
    if (!ctx) return;

    ctx.save();
    this.clipToPaintArea(ctx);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = COLOR_MAP[this.activeColor];
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = this.sprayRadius * Math.pow(Math.random(), 1.4);
      const px = x + Math.cos(angle) * d;
      const py = y + Math.sin(angle) * d;
      const r = 0.8 + Math.random() * 1.6;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  /** Dot stamp: one round blob of paint, a little bigger or smaller each time. */
  private placeDot(x: number, y: number) {
    const ctx = this.bufferCtx;
    if (!ctx) return;
    const colorHex = COLOR_MAP[this.activeColor];
    const radius = 12 + Math.random() * 7;

    // Fade to a clear version of the same colour, so the edge has no grey ring
    const [r, g, b] = hexToRgb(colorHex);
    const grad = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.86, colorHex);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.save();
    this.clipToPaintArea(ctx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A pluck per dot gives a playful rhythm while dragging
    const now = performance.now();
    if (now - this.lastDotSoundTime > 70) {
      const notes = [262, 294, 330, 392, 440];
      this.audio.play('synth:pluck', notes[Math.floor(Math.random() * notes.length)]);
      this.haptics.lightTap();
      this.lastDotSoundTime = now;
    }
  }

  /** Paint bucket: floods the touched patch of colour with the active colour. */
  private bucketFill(x: number, y: number) {
    const ctx = this.bufferCtx;
    if (!ctx || !this.canvas || typeof ctx.getImageData !== 'function') return;

    const top = Math.ceil(this.headerLineY + 2);
    const bottom = Math.floor(this.trayTop);
    const width = this.canvas.width;
    const height = bottom - top;
    if (height <= 0 || width <= 0) return;

    const image = ctx.getImageData(0, top, width, height);
    const changed = floodFill(
      image.data, width, height,
      x, y - top,
      hexToRgb(COLOR_MAP[this.activeColor]),
      40
    );

    if (changed > 0) {
      ctx.putImageData(image, 0, top);
      this.audio.play('bloop');
      this.audio.play('synth:chime', 523);
    } else {
      this.audio.play('synth:pluck', 120);
    }
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

    this.dragFeedback(dist);
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
  }

  private clearAll() {
    if (this.bufferCtx && this.canvas) {
      this.bufferCtx.fillStyle = PARCHMENT;
      this.bufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.audio.play('pop');
      this.haptics.lightTap();
    }
  }

  update(dt: number): void {
    // The airbrush keeps spraying while the finger rests in one place
    if (this.isDrawing && this.activeBrush === 'spray') {
      this.sprayAt(this.lastPos.x, this.lastPos.y, Math.max(6, Math.round(dt * 1.2)));
      const now = performance.now();
      if (now - this.audioThrottleTime > 160) {
        this.audio.play('synth:click', 150 + Math.floor(Math.random() * 40));
        this.haptics.lightTap();
        this.audioThrottleTime = now;
      }
    }
    this.render();
  }

  // ---------------------------------------------------------------- drawing

  private render() {
    if (!this.ctx || !this.canvas || !this.bufferCanvas) return;
    const ctx = this.ctx;

    // Draw the paint buffer onto the screen
    ctx.drawImage(this.bufferCanvas, 0, 0);

    // Draw header palette separator line
    ctx.strokeStyle = '#D4B896';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.headerLineY);
    ctx.lineTo(this.canvas.width, this.headerLineY);
    ctx.stroke();

    // Draw ceramic wells
    this.wells.forEach(well => {
      const isSelected = this.activeColor === well.id;
      const cx = well.x + well.width / 2;
      const cy = this.potsY + this.potsHeight / 2;

      // Draw shadow well backplate
      ctx.fillStyle = 'rgba(43, 45, 94, 0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, well.width / 2, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ceramic Ring
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isSelected ? '#3498DB' : INK;
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.beginPath();
      ctx.arc(cx, cy, well.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Paint inside well
      ctx.fillStyle = well.colorHex;
      ctx.beginPath();
      ctx.arc(cx, cy, well.width / 2 - 7, 0, Math.PI * 2);
      ctx.fill();

      // Selection Ring indicators
      if (isSelected) {
        ctx.strokeStyle = '#3498DB';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, well.width / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Labels below wells
      ctx.fillStyle = INK;
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.getToolName(well.id).toUpperCase(), cx, this.potsY + this.potsHeight - 6);
    });

    // Clear (✕) Button
    const rx = this.canvas.width - 50;
    const ry = this.potsY + this.potsHeight / 2;
    ctx.fillStyle = '#C0392B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(rx, ry, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', rx, ry + 1);

    // Tip Banner Text
    ctx.fillStyle = 'rgba(43, 45, 94, 0.45)';
    ctx.font = '500 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Pick a color and a brush, then paint!', this.canvas.width / 2, this.headerLineY + 10);

    this.renderTray(ctx);
  }

  /** Traces a rounded rectangle with lines and arcs (works on older Safari too). */
  private roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  }

  private renderTray(ctx: CanvasRenderingContext2D) {
    if (!this.canvas) return;
    const top = this.trayTop;
    const w = this.canvas.width;

    // Woven-band tray behind the brushes
    ctx.fillStyle = '#E8DBBF';
    ctx.fillRect(0, top, w, this.trayHeight);
    ctx.strokeStyle = '#D4B896';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(w, top);
    ctx.stroke();

    const canDash = typeof ctx.setLineDash === 'function';

    this.brushes.forEach(btn => {
      const selected = btn.id === this.activeBrush;
      const lift = selected ? -4 : 0;
      const x = btn.x;
      const y = btn.y + lift;

      // Soft shadow under the card-stock tag
      ctx.fillStyle = 'rgba(43, 45, 94, 0.12)';
      this.roundedRectPath(ctx, x, btn.y + 3, btn.width, btn.height, 8);
      ctx.fill();

      // Card-stock tag
      ctx.fillStyle = selected ? '#FFFFFF' : '#FBF6EA';
      ctx.strokeStyle = selected ? INK : 'rgba(43, 45, 94, 0.35)';
      ctx.lineWidth = selected ? 3 : 2;
      this.roundedRectPath(ctx, x, y, btn.width, btn.height, 8);
      ctx.fill();
      ctx.stroke();

      // Running stitch just inside the edge
      if (canDash) {
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = selected ? 'rgba(43, 45, 94, 0.45)' : 'rgba(43, 45, 94, 0.2)';
        ctx.lineWidth = 1.25;
        this.roundedRectPath(ctx, x + 5, y + 5, btn.width - 10, btn.height - 10, 5);
        ctx.stroke();
        ctx.restore();
      }

      this.drawBrushIcon(ctx, btn.id, x + btn.width / 2, y + 25);

      // Label, shrunk to fit narrow phones
      const label = this.getBrushName(btn.id).toUpperCase();
      let size = 10;
      ctx.font = `bold ${size}px Fredoka, sans-serif`;
      while (size > 7 && ctx.measureText(label).width > btn.width - 10) {
        size--;
        ctx.font = `bold ${size}px Fredoka, sans-serif`;
      }
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + btn.width / 2, y + btn.height - 14);
    });
  }

  /** Small pictures for each brush, drawn in the active colour with an ink outline. */
  private drawBrushIcon(ctx: CanvasRenderingContext2D, id: BrushId, cx: number, cy: number) {
    const color = COLOR_MAP[this.activeColor];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (id) {
      case 'smudge': {
        // A finger pulling a soft smear behind it
        ctx.strokeStyle = 'rgba(43, 45, 94, 0.18)';
        for (const [dy, len] of [[-2, 12], [4, 16], [10, 10]]) {
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(cx - 4 - len, cy + dy);
          ctx.lineTo(cx - 2, cy + dy);
          ctx.stroke();
        }
        ctx.fillStyle = '#F2C9A5';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        this.roundedRectPath(ctx, cx - 3, cy - 14, 14, 28, 7);
        ctx.fill();
        ctx.stroke();
        // Fingernail and knuckle crease
        ctx.fillStyle = '#FFFFFF';
        this.roundedRectPath(ctx, cx, cy - 11, 8, 8, 4);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5);
        ctx.lineTo(cx + 8, cy + 5);
        ctx.stroke();
        break;
      }
      case 'brush': {
        const pts: Array<[number, number]> = [[cx - 15, cy + 6], [cx - 5, cy - 5], [cx + 5, cy + 5], [cx + 15, cy - 6]];
        for (const [width, style] of [[12, INK], [8, color]] as Array<[number, string]>) {
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        }
        break;
      }
      case 'spray': {
        ctx.fillStyle = INK;
        ctx.beginPath();
        for (const [dx, dy] of SPRAY_ICON_DOTS) {
          ctx.moveTo(cx + dx + 2.6, cy + dy);
          ctx.arc(cx + dx, cy + dy, 2.6, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const [dx, dy] of SPRAY_ICON_DOTS) {
          ctx.moveTo(cx + dx + 1.7, cy + dy);
          ctx.arc(cx + dx, cy + dy, 1.7, 0, Math.PI * 2);
        }
        ctx.fill();
        break;
      }
      case 'dots': {
        ctx.fillStyle = color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        for (const [dx, dy, r] of [[-13, 4, 5], [0, -3, 6.5], [13, 4, 5]]) {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }
      case 'fill': {
        // Handle
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 6, 9, Math.PI, 0);
        ctx.stroke();
        // Bucket body
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 6);
        ctx.lineTo(cx + 8, cy - 6);
        ctx.lineTo(cx + 5, cy + 12);
        ctx.lineTo(cx - 9, cy + 12);
        ctx.lineTo(cx - 12, cy - 6);
        ctx.fill();
        ctx.stroke();
        // Paint at the rim, spilling over the edge
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 6);
        ctx.lineTo(cx + 8, cy - 6);
        ctx.lineTo(cx + 7.2, cy - 1);
        ctx.lineTo(cx - 11.2, cy - 1);
        ctx.lineTo(cx - 12, cy - 6);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 13, cy + 7, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  /**
   * Resizes the canvas while preserving existing painted artwork.
   * Re-calibrates well and brush positions for the new size.
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
    this.bufferCtx.fillStyle = PARCHMENT;
    this.bufferCtx.fillRect(0, 0, width, height);
    this.bufferCtx.drawImage(temp, 0, 0);

    // Re-calculate paint wells and brush tray for new canvas size
    this.setupWells();
    this.setupBrushes();
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
