import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';
import { CelebrationOverlay } from '../../ui/CelebrationOverlay';

/**
 * Equation Tower
 *
 * A block's height is its number: a 3 is three units tall. A knotted cord
 * beside the tower counts the units, and a line marks the target. Stack
 * blocks until the tower reaches the line exactly, and the tower itself is
 * the sum: 3 + 4 = 7 is a 3 block and a 4 block standing as tall as 7.
 *
 * Tap a block in the tray to drop it on the tower. Tap a block in the tower
 * to take it off. Blocks always stack straight, so a young player is never
 * punished for where they tapped.
 */

/** One wooden block standing in (or falling onto) the tower. */
export interface TowerBlock {
  id: number;
  value: number;
  /** Bottom edge in canvas px. */
  y: number;
  vy: number;
  /** Bottom edge once it has landed. */
  restY: number;
  state: 'falling' | 'resting';
  landed: boolean;
  squash: number;
}

interface LeavingBlock {
  value: number;
  top: number;
  t: number;
}

export interface TowerLevel {
  target: number;
  tray: number[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TowerLayout {
  mode: 'stack' | 'side';
  info: Rect;
  tower: Rect;
  /** Top of the base mat: the bottom of the tower. */
  baseY: number;
  cx: number;
  blockW: number;
  unit: number;
  tray: Rect;
  tiles: Rect[];
}

/** The first towers teach the idea with small numbers and few blocks. */
export const TOWER_LEVELS: TowerLevel[] = [
  { target: 3, tray: [1, 2] },
  { target: 4, tray: [1, 2, 3] },
  { target: 5, tray: [1, 2, 3] },
  { target: 6, tray: [1, 2, 3, 4] },
  { target: 7, tray: [1, 2, 3, 4, 5] },
  { target: 8, tray: [1, 2, 3, 4, 5] },
  { target: 9, tray: [1, 2, 3, 4, 5] },
  { target: 10, tray: [1, 2, 3, 4, 5] },
];

/** Level n (from 1). After the set levels, targets from 5 to 10 at random. */
export function towerLevel(n: number, previousTarget = 0, rand: () => number = Math.random): TowerLevel {
  if (n >= 1 && n <= TOWER_LEVELS.length) return TOWER_LEVELS[n - 1];
  let target = 5 + Math.floor(rand() * 6);
  if (target === previousTarget) target = target === 10 ? 5 : target + 1;
  return { target, tray: [1, 2, 3, 4, 5] };
}

/* Kipu's dyes, one per number, so a number keeps its colour everywhere. */
const DYES: Record<number, { fill: string; edge: string; text: string }> = {
  1: { fill: '#D9A646', edge: '#9C6D1F', text: '#3B2B1F' },
  2: { fill: '#B8432F', edge: '#7C2619', text: '#FFF7EC' },
  3: { fill: '#4F8048', edge: '#30552A', text: '#FFF7EC' },
  4: { fill: '#3A5897', edge: '#22386A', text: '#FFF7EC' },
  5: { fill: '#80467A', edge: '#552B51', text: '#FFF7EC' },
  6: { fill: '#2C7C78', edge: '#1A4F4C', text: '#FFF7EC' },
};
const dye = (v: number) => DYES[v] ?? DYES[6];
/** Colour for a number written on sand: the light ochre needs its darker edge. */
const numberInk = (v: number) => (v === 1 ? DYES[1].edge : dye(v).fill);

const SAND = '#EFE1C8';
const SAND_LINE = 'rgba(150, 112, 70, 0.07)';
const PAPER = '#FBF3E6';
const PAPER_EDGE = '#D9C3A0';
const STITCH = '#B79B74';
const INK = '#3B2B1F';
const INK_SOFT = '#6E5A48';
const ROPE = '#B4946A';
const ROPE_DARK = '#7D5F3F';
const GOOD = '#3F7A3A';
const WARN = '#B8432F';
const FONT = 'Fredoka, sans-serif';

/* Notes up a pentatonic scale, so a taller tower sings higher. */
const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

const GRAVITY = 2600;

export class EquationTowerGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private audio: AudioController;
  private haptics: HapticController;

  private level = 1;
  private target = 3;
  private tray: number[] = [];
  private blocks: TowerBlock[] = [];
  private leaving: LeavingBlock[] = [];
  private nextId = 1;

  private won = false;
  private winT = 0;
  private paused = false;
  private time = 0;
  private reducedMotion = false;

  private layout: TowerLayout | null = null;
  private nextBtn: Rect | null = null;
  private tilePress: number[] = [];
  private tileShake: number[] = [];
  private noFitT = 0;
  private timers: number[] = [];

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    this.audio.registerSound('pop', '/sounds/pop.ogg');
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = 1;
    this.paused = false;
    this.time = 0;
    this.noFitT = 0;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.loadLevel();
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  /* ---------- State ---------- */

  private loadLevel(previousTarget = 0) {
    const cfg = towerLevel(this.level, previousTarget);
    this.target = cfg.target;
    this.tray = cfg.tray.slice();
    this.tilePress = this.tray.map(() => 0);
    this.tileShake = this.tray.map(() => 0);
    this.blocks = [];
    this.leaving = [];
    this.won = false;
    this.winT = 0;
    this.noFitT = 0;
    this.relayout();
  }

  /** Sum of every block in the tower, landed or still dropping. */
  public getSum(): number {
    return this.blocks.reduce((s, b) => s + b.value, 0);
  }

  /** Units covered by blocks that have landed, counting up from the base. */
  private getRestingSum(): number {
    let s = 0;
    for (const b of this.blocks) {
      if (b.state !== 'resting') break;
      s += b.value;
    }
    return s;
  }

  private isSettled(): boolean {
    return this.blocks.every(b => b.state === 'resting');
  }

  /** Where each block's bottom edge sits when the tower is at rest. */
  private restPositions(): number[] {
    if (!this.layout) return this.blocks.map(() => 0);
    const { baseY, unit } = this.layout;
    let units = 0;
    return this.blocks.map(b => {
      const y = baseY - units * unit;
      units += b.value;
      return y;
    });
  }

  /** Drops a block of this value on the tower. False if it can't fit. */
  public addBlock(value: number): boolean {
    if (!this.layout || this.won) return false;
    const { baseY, unit, tower } = this.layout;
    const newSum = this.getSum() + value;
    if (baseY - newSum * unit < tower.y - 4) return false;

    const restY = baseY - (newSum - value) * unit;
    const startY = this.reducedMotion ? restY : Math.min(tower.y + value * unit, restY - 40);
    this.blocks.push({
      id: this.nextId++,
      value,
      y: startY,
      vy: 0,
      restY,
      state: this.reducedMotion ? 'resting' : 'falling',
      landed: this.reducedMotion,
      squash: 0,
    });
    if (this.reducedMotion) this.playLand(newSum);
    return true;
  }

  /** Takes a block out of the tower; the blocks above it drop down. */
  public removeBlock(id: number): void {
    const i = this.blocks.findIndex(b => b.id === id);
    if (i < 0 || !this.layout) return;
    const [b] = this.blocks.splice(i, 1);
    this.leaving.push({ value: b.value, top: b.y - b.value * this.layout.unit, t: 0 });

    const rests = this.restPositions();
    this.blocks.forEach((blk, j) => {
      blk.restY = rests[j];
      if (blk.y < blk.restY - 0.5) {
        if (this.reducedMotion) {
          blk.y = blk.restY;
        } else {
          blk.state = 'falling';
          blk.landed = false;
        }
      }
    });
    this.audio.play('pop');
  }

  private nextLevel() {
    const previous = this.target;
    this.level++;
    this.loadLevel(previous);
  }

  private triggerWin() {
    this.won = true;
    this.winT = 0;
    this.haptics.success();

    const notes = [NOTES[0], NOTES[2], NOTES[4], NOTES[5]];
    notes.forEach((f, i) => {
      this.timers.push(window.setTimeout(() => this.audio.play('synth:bell', f), i * 110));
    });

    if (this.layout) {
      const lineY = this.layout.baseY - this.target * this.layout.unit;
      CelebrationOverlay.getInstance().celebrate({
        x: this.layout.cx,
        y: lineY + 56,
        type: 'confetti',
        count: 50,
        message: `${this.equationText()}. You made ${this.target}!`,
        silent: true,
      });
    }
  }

  public equationText(): string {
    const parts = this.blocks.map(b => String(b.value));
    return `${parts.join(' + ')} = ${this.getSum()}`;
  }

  private playLand(unitsUpTo: number) {
    const f = NOTES[Math.max(0, Math.min(NOTES.length - 1, unitsUpTo - 1))];
    this.audio.play('synth:pluck', f);
  }

  /* ---------- Layout ---------- */

  private relayout() {
    if (!this.canvas) return;
    this.layout = this.computeLayout(this.canvas.width, this.canvas.height);
    const rests = this.restPositions();
    this.blocks.forEach((b, i) => {
      b.restY = rests[i];
      b.y = b.restY;
      b.vy = 0;
      b.state = 'resting';
      b.landed = true;
    });
  }

  private computeLayout(w: number, h: number): TowerLayout {
    const pad = 16;
    const n = Math.max(1, this.tray.length);
    const side = w > h && h < 560;

    let info: Rect;
    let tray: Rect;
    let tiles: Rect[];
    let towerRect: Rect;
    let baseY: number;

    if (!side) {
      const infoH = 132;
      const gap = 10;
      const tile = Math.max(48, Math.min(80, Math.floor((Math.min(w, 560) - pad * 2 - gap * (n - 1)) / n)));
      const trayH = tile + 28;
      info = { x: 0, y: 0, w, h: infoH };
      tray = { x: 0, y: h - trayH, w, h: trayH };
      const rowW = tile * n + gap * (n - 1);
      const x0 = (w - rowW) / 2;
      tiles = this.tray.map((_, i) => ({ x: x0 + i * (tile + gap), y: tray.y + 12, w: tile, h: tile }));
      baseY = tray.y - 18;
      towerRect = { x: 0, y: infoH, w, h: baseY - infoH };
    } else {
      const gap = 8;
      const tile = Math.max(44, Math.min(72, Math.floor((h - pad * 2 - gap * (n - 1)) / n)));
      const trayW = tile + pad * 2;
      const infoW = Math.max(180, Math.min(280, Math.floor(w * 0.32)));
      info = { x: 0, y: 0, w: infoW, h };
      tray = { x: w - trayW, y: 0, w: trayW, h };
      const colH = tile * n + gap * (n - 1);
      const y0 = (h - colH) / 2;
      tiles = this.tray.map((_, i) => ({ x: tray.x + pad, y: y0 + i * (tile + gap), w: tile, h: tile }));
      baseY = h - 22;
      towerRect = { x: infoW, y: 12, w: w - infoW - trayW, h: baseY - 12 };
    }

    const cx = towerRect.x + towerRect.w / 2;
    const blockW = Math.max(84, Math.min(150, Math.floor(towerRect.w * 0.3)));
    const unit = Math.max(12, Math.min(64, Math.floor((baseY - towerRect.y - 12) / (this.target + 2))));

    // A short tower leaves a gap under the prompt: move the prompt halfway down toward it.
    if (!side) {
      const need = (this.target + 2) * unit + 12;
      const spare = baseY - towerRect.y - need;
      if (spare > 0) {
        const shift = Math.round(spare / 2);
        info = { ...info, y: info.y + shift };
        towerRect = { ...towerRect, y: towerRect.y + shift, h: towerRect.h - shift };
      }
    }

    return { mode: side ? 'side' : 'stack', info, tower: towerRect, baseY, cx, blockW, unit, tray, tiles };
  }

  /* ---------- Input ---------- */

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.canvas || this.paused) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.tapAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  /** Keyboard play: number keys drop that block, Backspace takes the top one off, Enter goes on. */
  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.layout || this.paused) return;
    if (this.won) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.nextLevel();
      }
      return;
    }
    const n = Number(e.key);
    const i = this.tray.indexOf(n);
    if (i >= 0) {
      e.preventDefault();
      if (this.addBlock(n)) {
        this.tilePress[i] = 1;
        this.noFitT = 0;
      } else {
        this.tileShake[i] = 0.45;
        this.noFitT = 1.8;
      }
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && this.blocks.length > 0) {
      e.preventDefault();
      this.removeBlock(this.blocks[this.blocks.length - 1].id);
    }
  };

  /** Handles a tap at canvas coordinates. */
  public tapAt(x: number, y: number): void {
    const L = this.layout;
    if (!L) return;

    if (this.won) {
      if (this.winT > 0.7 || (this.nextBtn && inRect(x, y, this.nextBtn))) {
        this.haptics.lightTap();
        this.nextLevel();
      }
      return;
    }

    for (let i = 0; i < L.tiles.length; i++) {
      if (inRect(x, y, L.tiles[i], 4)) {
        if (this.addBlock(this.tray[i])) {
          this.tilePress[i] = 1;
          this.noFitT = 0;
          this.haptics.lightTap();
        } else {
          this.tileShake[i] = 0.45;
          this.noFitT = 1.8;
        }
        return;
      }
    }

    const left = L.cx - L.blockW / 2;
    if (x >= left - 6 && x <= left + L.blockW + 6) {
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const b = this.blocks[i];
        const top = b.y - b.value * L.unit;
        if (y >= top - 2 && y <= b.y + 2) {
          this.haptics.lightTap();
          this.removeBlock(b.id);
          return;
        }
      }
    }
  }

  /* ---------- Loop ---------- */

  update(dt: number): void {
    if (!this.ctx || !this.canvas || this.paused) return;
    const s = Math.min(dt, 50) / 1000;
    this.time += s;
    this.step(s);
    this.render();
  }

  /** Advances the blocks and timers by s seconds. */
  private step(s: number) {
    this.blocks.forEach((b, idx) => {
      if (b.state === 'falling') {
        b.vy += GRAVITY * s;
        b.y += b.vy * s;
        if (b.y >= b.restY) {
          b.y = b.restY;
          if (!b.landed) {
            b.landed = true;
            b.squash = Math.min(1, b.vy / 1400);
            const units = this.blocks.slice(0, idx + 1).reduce((t, k) => t + k.value, 0);
            this.playLand(units);
          }
          if (b.vy > 320) {
            b.vy = -b.vy * 0.2;
          } else {
            b.vy = 0;
            b.state = 'resting';
          }
        }
      }
      b.squash = Math.max(0, b.squash - s * 5);
    });

    for (let i = this.leaving.length - 1; i >= 0; i--) {
      this.leaving[i].t += s / 0.3;
      if (this.leaving[i].t >= 1) this.leaving.splice(i, 1);
    }
    for (let i = 0; i < this.tilePress.length; i++) {
      this.tilePress[i] = Math.max(0, this.tilePress[i] - s * 5);
      this.tileShake[i] = Math.max(0, this.tileShake[i] - s);
    }
    this.noFitT = Math.max(0, this.noFitT - s);

    if (!this.won && this.blocks.length > 0 && this.isSettled() && this.getSum() === this.target) {
      this.triggerWin();
    }
    if (this.won) this.winT += s;
  }

  /* ---------- Drawing ---------- */

  private render() {
    const ctx = this.ctx;
    const L = this.layout;
    if (!ctx || !this.canvas || !L) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = SAND;
    ctx.fillRect(0, 0, w, h);
    if (w < 120 || h < 120) return;
    ctx.fillStyle = SAND_LINE;
    for (let y = 7; y < h; y += 9) ctx.fillRect(0, y, w, y % 27 === 7 ? 2 : 1);

    this.drawBase(L);
    this.drawCord(L);
    this.drawGhostCells(L);
    this.drawBlocks(L);
    this.drawOverTint(L);
    this.drawLeaving(L);
    this.drawInfo(L);
    if (this.won) {
      this.drawNext(L);
    } else {
      this.nextBtn = null;
      this.drawTray(L);
    }
  }

  private drawBase(L: TowerLayout) {
    const ctx = this.ctx!;
    const matW = Math.min(L.tower.w - 24, L.blockW + 150);
    const x = L.cx - matW / 2;
    ctx.fillStyle = 'rgba(90, 60, 30, 0.12)';
    ctx.beginPath();
    ctx.ellipse(L.cx, L.baseY + 16, matW / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ROPE;
    ctx.beginPath();
    ctx.roundRect(x, L.baseY, matW, 14, 4);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, L.baseY, matW, 14, 4);
    ctx.clip();
    ctx.strokeStyle = ROPE_DARK;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let i = x - 14; i < x + matW + 14; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, L.baseY);
      ctx.lineTo(i + 8, L.baseY + 14);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawCord(L: TowerLayout) {
    const ctx = this.ctx!;
    const cordX = L.cx - L.blockW / 2 - 26;
    const lineY = L.baseY - this.target * L.unit;
    const resting = this.getRestingSum();

    // Target line across the tower
    ctx.strokeStyle = this.won ? GOOD : INK_SOFT;
    ctx.lineWidth = this.won ? 3 : 2;
    ctx.setLineDash(this.won ? [] : [7, 6]);
    ctx.beginPath();
    ctx.moveTo(cordX, lineY);
    ctx.lineTo(L.cx + L.blockW / 2 + 14, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // The cord, with a twist pattern, running up past the line
    ctx.strokeStyle = ROPE_DARK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cordX, L.baseY + 4);
    ctx.lineTo(cordX, lineY - 10);
    ctx.stroke();
    ctx.strokeStyle = ROPE;
    ctx.lineWidth = 2;
    for (let y = L.baseY; y > lineY - 8; y -= 6) {
      ctx.beginPath();
      ctx.moveTo(cordX - 2, y);
      ctx.lineTo(cordX + 2, y - 4);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // A knot for each unit; filled knots take the colour of the block beside them
    const unitDye: number[] = [];
    for (const b of this.blocks) for (let k = 0; k < b.value; k++) unitDye.push(b.value);
    const r = Math.max(4, Math.min(8, L.unit * 0.28));
    const labelEvery = L.unit >= 22 ? 1 : 2;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.round(Math.max(12, Math.min(16, L.unit * 0.5)))}px ${FONT}`;
    for (let u = 1; u <= this.target; u++) {
      const y = L.baseY - (u - 0.5) * L.unit;
      const filled = u <= resting;
      ctx.beginPath();
      ctx.arc(cordX, y, r, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = dye(unitDye[u - 1]).fill;
        ctx.fill();
        ctx.strokeStyle = dye(unitDye[u - 1]).edge;
      } else {
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.strokeStyle = ROPE_DARK;
      }
      ctx.lineWidth = 2;
      ctx.stroke();

      if (u % labelEvery === 0 || u === 1) {
        ctx.fillStyle = INK_SOFT;
        ctx.fillText(String(u), cordX - r - 6, y + 1);
      }
    }

    // The target tag hanging on the end of the line
    const tagX = L.cx + L.blockW / 2 + 14;
    const tagW = 46;
    const tagH = 36;
    this.drawTag(tagX, lineY - tagH / 2, tagW, tagH, this.won ? GOOD : PAPER);
    ctx.fillStyle = this.won ? '#FFF7EC' : INK;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.target), tagX + tagW / 2, lineY + 1);
  }

  /** Dotted empty cells from the tower's top up to the line. */
  private drawGhostCells(L: TowerLayout) {
    if (this.won) return;
    const sum = this.getSum();
    if (sum >= this.target) return;
    const ctx = this.ctx!;
    const x = L.cx - L.blockW / 2;
    ctx.strokeStyle = 'rgba(110, 90, 72, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    for (let u = sum; u < this.target; u++) {
      const top = L.baseY - (u + 1) * L.unit;
      ctx.beginPath();
      ctx.roundRect(x + 6, top + 3, L.blockW - 12, Math.max(4, L.unit - 6), 4);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawBlocks(L: TowerLayout) {
    for (const b of this.blocks) {
      const height = b.value * L.unit;
      const sq = b.squash;
      const bw = L.blockW * (1 + 0.05 * sq);
      const bh = height * (1 - 0.07 * sq);
      this.drawBlock(L.cx - bw / 2, b.y - bh, bw, bh, b.value, L.unit * (1 - 0.07 * sq), this.won);
    }
  }

  private drawBlock(x: number, top: number, w: number, h: number, value: number, unit: number, glow: boolean) {
    const ctx = this.ctx!;
    const d = dye(value);

    if (glow) {
      ctx.fillStyle = `rgba(255, 236, 170, ${0.35 + 0.2 * Math.sin(this.time * 6)})`;
      ctx.beginPath();
      ctx.roundRect(x - 5, top - 5, w + 10, h + 10, 9);
      ctx.fill();
    }

    ctx.fillStyle = d.fill;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 6);
    ctx.fill();

    // Light on the top face, shade at the bottom, faint grain: painted wood
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x, top, w, 4);
    ctx.fillStyle = 'rgba(40, 20, 0, 0.16)';
    ctx.fillRect(x, top + h - 4, w, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let gx = x + 10; gx < x + w; gx += 17) ctx.fillRect(gx, top, 2, h);
    ctx.restore();

    // A groove between units so they can be counted
    ctx.strokeStyle = d.edge;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    for (let k = 1; k < value; k++) {
      const gy = top + k * unit;
      ctx.beginPath();
      ctx.moveTo(x + 6, gy);
      ctx.lineTo(x + w - 6, gy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = d.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 6);
    ctx.stroke();

    const size = Math.round(Math.max(14, Math.min(34, value === 1 ? unit * 0.78 : unit * 0.9 + 4)));
    ctx.fillStyle = d.text;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + w / 2, top + h / 2 + 1);
  }

  /** Hatches the part of the tower that sticks up past the line. */
  private drawOverTint(L: TowerLayout) {
    const sum = this.getSum();
    if (sum <= this.target) return;
    const ctx = this.ctx!;
    const lineY = L.baseY - this.target * L.unit;
    const topY = L.baseY - sum * L.unit;
    const x = L.cx - L.blockW / 2 - 4;
    const h = lineY - topY + 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, topY - 4, L.blockW + 8, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(251, 243, 230, 0.5)';
    ctx.fillRect(x, topY - 4, L.blockW + 8, h);
    ctx.strokeStyle = 'rgba(184, 67, 47, 0.55)';
    ctx.lineWidth = 3;
    for (let i = x - h; i < x + L.blockW + 8; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, lineY);
      ctx.lineTo(i + h, topY - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLeaving(L: TowerLayout) {
    const ctx = this.ctx!;
    for (const lb of this.leaving) {
      ctx.globalAlpha = Math.max(0, 1 - lb.t);
      this.drawBlock(L.cx - L.blockW / 2, lb.top - lb.t * 40, L.blockW, lb.value * L.unit, lb.value, L.unit, false);
    }
    ctx.globalAlpha = 1;
  }

  private drawInfo(L: TowerLayout) {
    const ctx = this.ctx!;
    const I = L.info;
    const maxW = I.w - 32;
    const cx = I.x + I.w / 2;

    // "Make 7" tag, or "You made 7!" once it's done
    const top = I.y + (L.mode === 'stack' ? 12 : 16);
    const lead = this.won ? 'You made' : 'Make';
    const numText = this.won ? `${this.target}!` : String(this.target);
    ctx.font = `600 22px ${FONT}`;
    const leadW = ctx.measureText(`${lead} `).width;
    ctx.font = `700 34px ${FONT}`;
    const numW = ctx.measureText(numText).width;
    const tagW = Math.min(maxW, leadW + numW + 40);
    const tagH = 54;
    this.drawTag(cx - tagW / 2, top, tagW, tagH, this.won ? GOOD : PAPER);
    const textX = cx - (leadW + numW) / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = this.won ? '#FFF7EC' : INK;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(lead, textX, top + tagH / 2 + 2);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(numText, textX + leadW, top + tagH / 2 + 1);

    // The tower as an equation: 3 + 4 = 7
    const eqY = top + tagH + 26;
    if (this.blocks.length > 0) this.drawEquation(cx, eqY, maxW);

    // One plain hint
    let hint = '';
    let hintColor = INK_SOFT;
    const sum = this.getSum();
    if (this.won) {
      hint = '';
    } else if (this.noFitT > 0) {
      hint = 'Too tall to fit! Try a smaller one.';
      hintColor = WARN;
    } else if (this.blocks.length === 0) {
      hint = L.mode === 'stack' ? 'Tap a block below to build up to the line' : 'Tap a block to build up to the line';
    } else if (sum > this.target) {
      hint = 'Too tall! Tap a block to take it off.';
      hintColor = WARN;
    } else if (sum < this.target) {
      hint = 'Keep building up to the line';
    }
    if (!hint) return;

    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = hintColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, hint, maxW);
    const hintY = this.blocks.length > 0 ? eqY + 28 : eqY - 2;
    lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, cx, hintY + i * 20));
  }

  private drawEquation(cx: number, y: number, maxW: number) {
    const ctx = this.ctx!;
    const sum = this.getSum();
    let tokens: Array<{ text: string; color: string; bold: boolean }> = [];
    this.blocks.forEach((b, i) => {
      if (i > 0) tokens.push({ text: '+', color: INK_SOFT, bold: false });
      tokens.push({ text: String(b.value), color: numberInk(b.value), bold: true });
    });
    tokens.push({ text: '=', color: INK_SOFT, bold: false });
    const totalColor = sum === this.target ? GOOD : sum > this.target ? WARN : INK;
    tokens.push({ text: String(sum), color: totalColor, bold: true });

    let size = 26;
    const measure = () => {
      let total = 0;
      for (const t of tokens) {
        ctx.font = `${t.bold ? 700 : 500} ${size}px ${FONT}`;
        total += ctx.measureText(t.text).width + size * 0.3;
      }
      return total - size * 0.3;
    };
    let width = measure();
    while (width > maxW && size > 15) {
      size -= 1;
      width = measure();
    }
    if (width > maxW) {
      // Too many blocks to list: keep the last few
      tokens = [{ text: '…', color: INK_SOFT, bold: false }, ...tokens.slice(-7)];
      width = measure();
    }

    let x = cx - width / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const t of tokens) {
      ctx.font = `${t.bold ? 700 : 500} ${size}px ${FONT}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
      x += ctx.measureText(t.text).width + size * 0.3;
    }
  }

  private drawTray(L: TowerLayout) {
    const ctx = this.ctx!;
    const maxV = Math.max(5, ...this.tray);
    const hintPulse = this.blocks.length === 0 ? 0.5 + 0.5 * Math.sin(this.time * 4) : 0;

    L.tiles.forEach((t, i) => {
      const v = this.tray[i];
      const d = dye(v);
      const press = this.tilePress[i] ?? 0;
      const shake = this.tileShake[i] ?? 0;
      const dx = shake > 0 ? Math.sin(shake * 60) * 5 * (shake / 0.45) : 0;
      const sc = 1 - 0.08 * press;
      const x = t.x + dx + (t.w * (1 - sc)) / 2;
      const y = t.y + (t.h * (1 - sc)) / 2;
      const tw = t.w * sc;
      const th = t.h * sc;

      if (hintPulse > 0) {
        ctx.strokeStyle = `rgba(201, 139, 47, ${0.25 + 0.5 * hintPulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 4, tw + 8, th + 8, 9);
        ctx.stroke();
      }
      this.drawTag(x, y, tw, th, PAPER);

      // A small block on the tile, as tall as its number
      const barW = Math.max(12, tw * 0.24);
      const fullH = th - 18;
      const barH = Math.max(8, (fullH * v) / maxV);
      const barX = x + tw * 0.18;
      const barBottom = y + th - 9;
      ctx.fillStyle = d.fill;
      ctx.beginPath();
      ctx.roundRect(barX, barBottom - barH, barW, barH, 3);
      ctx.fill();
      ctx.strokeStyle = d.edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      for (let k = 1; k < v; k++) {
        const gy = barBottom - barH + (k * barH) / v;
        ctx.beginPath();
        ctx.moveTo(barX + 2, gy);
        ctx.lineTo(barX + barW - 2, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = INK;
      ctx.font = `700 ${Math.round(Math.min(34, th * 0.5))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), x + tw * 0.64, y + th / 2 + 1);
    });
  }

  private drawNext(L: TowerLayout) {
    const ctx = this.ctx!;
    const T = L.tray;
    const bw = L.mode === 'stack' ? Math.min(T.w - 32, 240) : T.w - 16;
    const bh = 56;
    const x = T.x + (T.w - bw) / 2;
    const y = T.y + (T.h - bh) / 2;
    this.nextBtn = { x, y, w: bw, h: bh };

    ctx.globalAlpha = Math.min(1, this.winT * 4);
    ctx.fillStyle = GOOD;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 247, 236, 0.7)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, bw - 8, bh - 8, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FFF7EC';
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(L.mode === 'stack' ? 'Next tower  →' : 'Next  →', x + bw / 2, y + bh / 2 + 1);
    ctx.globalAlpha = 1;
  }

  /** Card-stock tag with a stitched edge, like Kipu's labels. */
  private drawTag(x: number, y: number, w: number, h: number, fill: string) {
    const ctx = this.ctx!;
    ctx.fillStyle = 'rgba(80, 50, 20, 0.14)';
    ctx.beginPath();
    ctx.roundRect(x, y + 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = fill === PAPER ? PAPER_EDGE : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = fill === PAPER ? STITCH : 'rgba(255, 247, 236, 0.6)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------- Lifecycle ---------- */

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  resize(_width?: number, _height?: number): void {
    this.relayout();
  }

  destroy(): void {
    this.canvas?.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.timers.forEach(t => window.clearTimeout(t));
    this.timers = [];
    this.blocks = [];
    this.leaving = [];
    this.layout = null;
    this.canvas = null;
    this.ctx = null;
  }
}

function inRect(x: number, y: number, r: Rect, slop = 0): boolean {
  return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(tryLine).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}
