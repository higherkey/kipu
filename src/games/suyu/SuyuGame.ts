import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';
import {
  type Region,
  type LevelInfo,
  buildLevel,
  getLevelInfo,
  computeDefense,
  canAttack,
  maxSendable,
  resolveAttack,
  reinforcementsFor,
  checkOutcome,
  placeRivalReinforcements,
  planRivalAttack,
} from './SuyuRules';

/**
 * Suyu — "region" in Quechua (as in Tawantinsuyu, the four regions).
 * A small area-control game where every capture is a math problem:
 * work out a region's defense and send exactly that many knots.
 */

type Phase = 'intro' | 'place' | 'attack' | 'rival' | 'won' | 'lost';

interface Button {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  enabled: boolean;
  primary?: boolean;
}

interface Toast {
  text: string;
  color: string;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

const COLORS = {
  bg: '#F5EDD8',
  bgDeep: '#EADFC4',
  ink: '#3B2F22',
  inkSoft: '#7A6A55',
  cord: '#8B6F47',
  player: '#14B8A6',
  playerDark: '#0F766E',
  rival: '#E76F51',
  rivalDark: '#B4472E',
  neutral: '#D6CCB8',
  neutralDark: '#9C8F78',
  wall: '#B45309',
  hill: '#4D7C0F',
  banner: '#7C3AED',
  gold: '#F59E0B',
  panel: '#FFF9EC',
  disabled: '#CFC6B3',
};

const TOP_H = 60;
const BOTTOM_H = 140;

export class SuyuGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly audio: AudioController;
  private readonly haptics: HapticController;

  private regions: Region[] = [];
  private level = 1;
  private levelInfo: LevelInfo = getLevelInfo(1);
  private stars = 0;
  private phase: Phase = 'intro';
  private paused = false;

  private placeRemaining = 0;
  private selectedFrom: number | null = null;
  private selectedTo: number | null = null;
  private sendAmount = 1;
  private hintUsed = false;

  private rivalTimer = 0;
  private rivalStep: 'place' | 'attack' = 'place';
  private rivalAttacksDone = 0;

  private toast: Toast | null = null;
  private particles: Particle[] = [];
  private flashes = new Map<number, number>();
  private time = 0;
  private buttons: Button[] = [];

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
  }

  // ───────────────────────── Lifecycle ─────────────────────────

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = 0;
    this.paused = false;
    this.startLevel(1);

    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
  }

  update(dt: number): void {
    if (this.paused) return;
    const dtSec = Math.min(dt, 100) / 1000;
    this.time += dtSec;

    if (this.phase === 'rival') this.updateRival(dtSec);

    if (this.toast) {
      this.toast.life -= dtSec;
      if (this.toast.life <= 0) this.toast = null;
    }
    for (const [id, t] of this.flashes) {
      const next = t - dtSec;
      if (next <= 0) this.flashes.delete(id);
      else this.flashes.set(id, next);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 220 * dtSec;
      p.life -= dtSec;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.render();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  resize(): void {
    this.render();
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    }
    this.canvas = null;
    this.ctx = null;
    this.regions = [];
    this.particles = [];
    this.flashes.clear();
    this.buttons = [];
  }

  // ───────────────────────── Public state (for tests / UI) ─────────────────────────

  public getState() {
    return {
      level: this.level,
      stars: this.stars,
      phase: this.phase,
      placeRemaining: this.placeRemaining,
      selectedFrom: this.selectedFrom,
      selectedTo: this.selectedTo,
      sendAmount: this.sendAmount,
      regions: this.regions,
    };
  }

  // ───────────────────────── Flow ─────────────────────────

  private startLevel(level: number) {
    this.level = level;
    this.levelInfo = getLevelInfo(level);
    this.regions = buildLevel(level);
    this.phase = 'intro';
    this.clearSelection();
    this.toast = null;
    this.particles = [];
    this.flashes.clear();
  }

  private startPlayerTurn() {
    const outcome = checkOutcome(this.regions);
    if (outcome !== 'playing') {
      this.endLevel(outcome);
      return;
    }
    this.placeRemaining = reinforcementsFor(this.regions, 'player');
    this.phase = 'place';
    this.clearSelection();
  }

  private startRivalTurn() {
    this.clearSelection();
    this.phase = 'rival';
    this.rivalStep = 'place';
    this.rivalTimer = 0.6;
    this.rivalAttacksDone = 0;
  }

  private updateRival(dtSec: number) {
    this.rivalTimer -= dtSec;
    if (this.rivalTimer > 0) return;

    if (this.rivalStep === 'place') {
      const id = placeRivalReinforcements(this.regions);
      if (id >= 0) {
        this.flashes.set(id, 0.6);
        this.audio.play('synth:click', 330);
      }
      this.rivalStep = 'attack';
      this.rivalTimer = 0.8;
      return;
    }

    const plan = this.rivalAttacksDone < this.levelInfo.rivalAttacks ? planRivalAttack(this.regions) : null;
    if (!plan) {
      this.startPlayerTurn();
      return;
    }

    const targetWasPlayer = this.regions[plan.to].owner === 'player';
    resolveAttack(this.regions, plan.from, plan.to, plan.sent);
    this.rivalAttacksDone++;
    this.flashes.set(plan.to, 0.8);
    if (targetWasPlayer) {
      this.audio.play('synth:drum', 110);
      this.haptics.heavyImpact();
      this.showToast('The rival took one of your regions!', COLORS.rivalDark);
    } else {
      this.audio.play('synth:pluck', 196);
    }
    this.rivalTimer = 0.9;

    if (checkOutcome(this.regions) === 'lost') this.endLevel('lost');
  }

  private endLevel(outcome: 'won' | 'lost') {
    this.phase = outcome;
    this.clearSelection();
    if (outcome === 'won') {
      this.audio.play('synth:bell', 'C5');
      setTimeout(() => this.audio.play('synth:chime', 'E5'), 150);
      setTimeout(() => this.audio.play('synth:bell', 'G5'), 300);
      this.haptics.success();
      const c = this.canvas;
      if (c) this.burst(c.width / 2, c.height / 2, COLORS.gold, 40);
    } else {
      this.audio.play('synth:drum', 90);
      this.haptics.heavyImpact();
    }
  }

  private clearSelection() {
    this.selectedFrom = null;
    this.selectedTo = null;
    this.sendAmount = 1;
    this.hintUsed = false;
  }

  // ───────────────────────── Actions ─────────────────────────

  private tapRegion(id: number) {
    const r = this.regions[id];
    if (!r) return;

    if (this.phase === 'place') {
      if (r.owner !== 'player') return;
      r.troops++;
      this.placeRemaining--;
      this.flashes.set(id, 0.3);
      this.audio.play('synth:pluck', 392 + this.placeRemaining * 20);
      this.haptics.lightTap();
      if (this.placeRemaining <= 0) {
        this.phase = 'attack';
        this.showToast('Now attack! Tap your region, then a neighbor.', COLORS.ink);
      }
      return;
    }

    if (this.phase !== 'attack') return;

    if (r.owner === 'player') {
      if (r.troops < 2) {
        this.showToast('A region needs 2 or more knots to attack.', COLORS.inkSoft);
        this.selectedFrom = null;
        this.selectedTo = null;
        return;
      }
      this.selectedFrom = id;
      this.selectedTo = null;
      this.audio.play('synth:click', 523);
      this.haptics.lightTap();
      return;
    }

    if (this.selectedFrom !== null && canAttack(this.regions, this.selectedFrom, id)) {
      this.selectedTo = id;
      this.sendAmount = 1;
      this.hintUsed = false;
      this.audio.play('synth:click', 659);
      this.haptics.lightTap();
      return;
    }

    if (this.selectedFrom !== null) {
      this.showToast('Pick a region connected by a cord.', COLORS.inkSoft);
    }
    this.selectedTo = null;
  }

  private adjustSend(delta: number) {
    if (this.selectedFrom === null) return;
    const max = maxSendable(this.regions[this.selectedFrom]);
    const next = Math.max(1, Math.min(max, this.sendAmount + delta));
    if (next !== this.sendAmount) {
      this.sendAmount = next;
      this.audio.play('synth:pluck', 262 + next * 18);
      this.haptics.lightTap();
    }
  }

  private doAttack() {
    if (this.selectedFrom === null || this.selectedTo === null) return;
    const toId = this.selectedTo;
    const result = resolveAttack(this.regions, this.selectedFrom, toId, this.sendAmount);
    const pos = this.regionPos(this.regions[toId]);

    if (result.success && result.perfect) {
      if (!this.hintUsed) this.stars++;
      this.showToast(
        this.hintUsed
          ? `Perfect! ${result.sent} = ${result.needed} (+${result.survivors} bonus knots)`
          : `Perfect! ${result.sent} = ${result.needed}  ★`,
        COLORS.gold,
      );
      this.audio.play('synth:bell', 'C5');
      setTimeout(() => this.audio.play('synth:chime', 'G5'), 120);
      this.haptics.success();
      this.burst(pos.x, pos.y, COLORS.gold, 24);
    } else if (result.success) {
      this.showToast(`Captured! ${result.sent} ≥ ${result.needed}. Exactly ${result.needed} earns a ★`, COLORS.playerDark);
      this.audio.play('synth:pluck', 523);
      this.haptics.lightTap();
      this.burst(pos.x, pos.y, COLORS.player, 12);
    } else {
      this.showToast(`Too few! Needed ${result.needed}: ${result.breakdown.steps.join(', ')}`, COLORS.rivalDark);
      this.audio.play('synth:drum', 120);
      this.haptics.heavyImpact();
    }
    this.flashes.set(toId, 0.6);

    const from = this.regions[this.selectedFrom];
    const keepFrom = from.troops >= 2 ? this.selectedFrom : null;
    this.clearSelection();
    this.selectedFrom = keepFrom;

    if (checkOutcome(this.regions) === 'won') this.endLevel('won');
  }

  private pressButton(id: string) {
    switch (id) {
      case 'start':
        this.startPlayerTurn();
        break;
      case 'minus':
        this.adjustSend(-1);
        break;
      case 'plus':
        this.adjustSend(1);
        break;
      case 'attack':
        this.doAttack();
        break;
      case 'hint':
        this.hintUsed = true;
        this.audio.play('synth:chime', 784);
        break;
      case 'endTurn':
        this.startRivalTurn();
        break;
      case 'next':
        this.startLevel(this.level + 1);
        break;
      case 'retry':
        this.startLevel(this.level);
        break;
    }
  }

  // ───────────────────────── Input ─────────────────────────

  private readonly handleMouseDown = (e: MouseEvent) => {
    this.handlePointer(e.clientX, e.clientY);
  };

  private readonly handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0] ?? e.touches[0];
    if (t) this.handlePointer(t.clientX, t.clientY);
  };

  private handlePointer(clientX: number, clientY: number) {
    if (!this.canvas || this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? this.canvas.height / rect.height : 1;
    this.handleTap((clientX - rect.left) * sx, (clientY - rect.top) * sy);
  }

  /** Canvas-space tap. Public so tests can drive the game directly. */
  public handleTap(x: number, y: number) {
    // Make sure hit areas reflect the current state.
    this.render();

    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.enabled) this.pressButton(b.id);
        return;
      }
    }

    if (this.phase === 'intro') {
      this.startPlayerTurn();
      return;
    }
    if (this.phase !== 'place' && this.phase !== 'attack') return;

    const radius = this.nodeRadius();
    for (const r of this.regions) {
      const p = this.regionPos(r);
      if (Math.hypot(x - p.x, y - p.y) <= radius * 1.15) {
        this.tapRegion(r.id);
        return;
      }
    }

    if (this.phase === 'attack') this.clearSelection();
  }

  // ───────────────────────── Layout helpers ─────────────────────────

  private mapArea() {
    const w = this.canvas?.width ?? 800;
    const h = this.canvas?.height ?? 600;
    const r = this.nodeRadiusFor(w, h);
    const padX = r + 16;
    const top = TOP_H + 44 + r; // leaves a lane for the toast
    const bottom = h - BOTTOM_H - r * 1.9;
    return { x: padX, y: top, w: Math.max(10, w - padX * 2), h: Math.max(10, bottom - top) };
  }

  private nodeRadiusFor(w: number, h: number) {
    const usable = Math.min(w, h - TOP_H - BOTTOM_H);
    return Math.max(22, Math.min(46, usable * 0.09));
  }

  private nodeRadius() {
    return this.nodeRadiusFor(this.canvas?.width ?? 800, this.canvas?.height ?? 600);
  }

  public regionPos(r: Region) {
    const a = this.mapArea();
    return { x: a.x + r.x * a.w, y: a.y + r.y * a.h };
  }

  private showToast(text: string, color: string) {
    this.toast = { text, color, life: 2.8 };
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 80,
        color: i % 3 === 0 ? '#FFFFFF' : color,
        life: 0.6 + Math.random() * 0.6,
      });
    }
  }

  // ───────────────────────── Rendering ─────────────────────────

  private render() {
    const ctx = this.ctx;
    const c = this.canvas;
    if (!ctx || !c) return;
    const w = c.width;
    const h = c.height;
    this.buttons = [];

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    this.drawCords(ctx);
    for (const r of this.regions) this.drawRegion(ctx, r);
    this.drawParticles(ctx);
    this.drawTopBar(ctx, w);
    this.drawBottomPanel(ctx, w, h);
    this.drawToast(ctx, w);

    if (this.phase === 'intro') this.drawCard(ctx, w, h, `Level ${this.level}: ${this.levelInfo.title}`, this.levelInfo.lesson, 'start', 'Start');
    if (this.phase === 'won') this.drawCard(ctx, w, h, 'Region united!', `You conquered level ${this.level}. Stars: ★ ${this.stars}`, 'next', 'Next Level');
    if (this.phase === 'lost') this.drawCard(ctx, w, h, 'The rival won this time', 'Count the defense carefully before you attack.', 'retry', 'Try Again');
  }

  private drawCords(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = COLORS.cord;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55;
    for (const r of this.regions) {
      const a = this.regionPos(r);
      for (const n of r.neighbors) {
        if (n < r.id) continue;
        const b = this.regionPos(this.regions[n]);
        const active =
          this.selectedFrom !== null &&
          ((r.id === this.selectedFrom && n === this.selectedTo) || (n === this.selectedFrom && r.id === this.selectedTo));
        ctx.lineWidth = active ? 7 : 4;
        ctx.strokeStyle = active ? COLORS.gold : COLORS.cord;
        ctx.globalAlpha = active ? 1 : 0.55;
        ctx.beginPath();
        // Slight sag like a hanging cord.
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + 10;
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private ownerColors(r: Region) {
    if (r.owner === 'player') return { fill: COLORS.player, edge: COLORS.playerDark, text: '#FFFFFF' };
    if (r.owner === 'rival') return { fill: COLORS.rival, edge: COLORS.rivalDark, text: '#FFFFFF' };
    return { fill: COLORS.neutral, edge: COLORS.neutralDark, text: COLORS.ink };
  }

  private drawRegion(ctx: CanvasRenderingContext2D, r: Region) {
    const p = this.regionPos(r);
    const R = this.nodeRadius();
    const col = this.ownerColors(r);
    const flash = this.flashes.get(r.id) ?? 0;
    const scale = 1 + flash * 0.25;

    const isFrom = this.selectedFrom === r.id;
    const isTo = this.selectedTo === r.id;
    const isTargetable =
      this.phase === 'attack' && this.selectedFrom !== null && !isTo && canAttack(this.regions, this.selectedFrom, r.id);
    const isPlaceable = this.phase === 'place' && r.owner === 'player';

    // Hanging knot cord (place value: big knots = tens, small knots = ones)
    // Hung from the lower-left so it doesn't overlap the vertical link cords.
    this.drawKnotCord(ctx, p.x - R * 0.62, p.y + R * 0.78 * scale, R, r.troops, col.edge);

    // Highlight rings
    if (isTargetable || isPlaceable) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.strokeStyle = isPlaceable ? COLORS.player : COLORS.gold;
      ctx.globalAlpha = 0.35 + pulse * 0.4;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * scale + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = col.fill;
    ctx.strokeStyle = isFrom || isTo ? COLORS.gold : col.edge;
    ctx.lineWidth = isFrom || isTo ? 6 : 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = col.text;
    ctx.font = `bold ${Math.round(R * 0.85)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(r.troops), p.x, p.y + 1);

    // Modifier badges
    const bs = Math.max(16, R * 0.5);
    if (r.wall > 0) this.drawBadge(ctx, p.x - R * 0.85, p.y - R * 0.85, bs, COLORS.wall, `+${r.wall}`, 'wall');
    if (r.hill > 1) this.drawBadge(ctx, p.x + R * 0.85, p.y - R * 0.85, bs, COLORS.hill, `×${r.hill}`, 'hill');
    if (r.banner) this.drawBadge(ctx, p.x + R * 0.95, p.y + R * 0.6, bs, COLORS.banner, '½', 'banner');
  }

  private drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, label: string, kind: 'wall' | 'hill' | 'banner') {
    const w = size * 1.5;
    const h = size;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (kind === 'hill') {
      ctx.moveTo(x - w / 2, y + h / 2);
      ctx.lineTo(x, y - h * 0.75);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.closePath();
    } else if (kind === 'banner') {
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y - h / 2);
      ctx.lineTo(x + w / 3, y);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
    } else {
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(size * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, kind === 'hill' ? y + h * 0.12 : y + 1);
  }

  private drawKnotCord(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, troops: number, color: string) {
    const tens = Math.min(9, Math.floor(troops / 10));
    const ones = troops % 10;
    const len = R * 1.55;
    ctx.strokeStyle = COLORS.cord;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();

    ctx.fillStyle = color;
    const big = R * 0.15;
    const small = R * 0.085;
    let cy = y + big + 2;
    for (let i = 0; i < tens; i++) {
      ctx.beginPath();
      ctx.arc(x, cy, big, 0, Math.PI * 2);
      ctx.fill();
      cy += big * 2 + 1;
    }
    if (tens > 0) cy += 4;
    const step = Math.min(small * 2 + 1, (y + len - cy) / Math.max(1, ones));
    for (let i = 0; i < ones; i++) {
      ctx.beginPath();
      ctx.arc(x, cy, small, 0, Math.PI * 2);
      ctx.fill();
      cy += step;
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTopBar(ctx: CanvasRenderingContext2D, w: number) {
    ctx.fillStyle = COLORS.bgDeep;
    ctx.fillRect(0, 0, w, TOP_H);

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Level ${this.level} · ${this.levelInfo.title}`, 16, TOP_H / 2 - 9);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`★ ${this.stars}`, 16, TOP_H / 2 + 12);

    if (this.phase === 'attack') {
      const bw = 112;
      this.addButton(ctx, { id: 'endTurn', x: w - bw - 12, y: 10, w: bw, h: TOP_H - 20, label: 'End Turn', enabled: true });
    } else if (this.phase === 'rival') {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.rivalDark;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText("Rival's turn…", w - 16, TOP_H / 2);
    }
  }

  private drawBottomPanel(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const y0 = h - BOTTOM_H;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, y0, w, BOTTOM_H);
    ctx.strokeStyle = COLORS.bgDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();

    const line1 = y0 + 30;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ink;

    if (this.phase === 'place') {
      this.fitText(ctx, `Tap your teal regions to add knots: ${this.placeRemaining} left`, w / 2, line1 + 20, w - 32, 18, true);
      return;
    }
    if (this.phase === 'rival') {
      this.fitText(ctx, 'The rival is placing knots and attacking…', w / 2, line1 + 20, w - 32, 17, false);
      return;
    }
    if (this.phase !== 'attack') return;

    if (this.selectedFrom === null) {
      this.fitText(ctx, 'Tap one of your regions to attack from.', w / 2, line1 + 20, w - 32, 17, false);
      return;
    }
    if (this.selectedTo === null) {
      this.fitText(ctx, 'Now tap a glowing neighbor to attack.', w / 2, line1 + 20, w - 32, 17, false);
      return;
    }

    const from = this.regions[this.selectedFrom];
    const to = this.regions[this.selectedTo];
    const parts = [`${to.troops} knots`];
    if (to.hill > 1) parts.push(`Hill ×${to.hill}`);
    if (to.wall > 0) parts.push(`Wall +${to.wall}`);
    if (from.banner) parts.push('Your Banner: half');
    let info = `Defense: ${parts.join(' · ')}`;
    if (this.levelInfo.showTotals || this.hintUsed) {
      const d = computeDefense(to, from.banner);
      info += this.hintUsed && d.steps.length > 0 && (to.hill > 1 || to.wall > 0 || from.banner)
        ? `  →  ${d.steps.join(', ')}`
        : `  →  need ${d.total}`;
    }
    this.fitText(ctx, info, w / 2, line1, w - 24, 16, true);

    // Controls row
    const bh = 56;
    const gap = 8;
    const hintW = 44;
    const stepW = 48;
    const numW = 60;
    const atkW = Math.min(130, Math.max(96, w - 32 - hintW - stepW * 2 - numW - gap * 4));
    const total = hintW + stepW * 2 + numW + atkW + gap * 4;
    let x = (w - total) / 2;
    const y = y0 + 62;
    const max = maxSendable(from);

    this.addButton(ctx, { id: 'hint', x, y, w: hintW, h: bh, label: '?', enabled: !this.hintUsed && !this.levelInfo.showTotals });
    x += hintW + gap;
    this.addButton(ctx, { id: 'minus', x, y, w: stepW, h: bh, label: '−', enabled: this.sendAmount > 1 });
    x += stepW + gap;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, numW, bh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(this.sendAmount), x + numW / 2, y + bh / 2 - 4);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = COLORS.inkSoft;
    ctx.fillText(`of ${max}`, x + numW / 2, y + bh - 9);
    x += numW + gap;

    this.addButton(ctx, { id: 'plus', x, y, w: stepW, h: bh, label: '+', enabled: this.sendAmount < max });
    x += stepW + gap;
    this.addButton(ctx, { id: 'attack', x, y, w: atkW, h: bh, label: 'Attack!', enabled: true, primary: true });
  }

  private drawToast(ctx: CanvasRenderingContext2D, w: number) {
    if (!this.toast) return;
    const alpha = Math.min(1, this.toast.life / 0.4);
    const y = TOP_H + 24;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,249,236,0.95)';
    ctx.strokeStyle = this.toast.color;
    ctx.lineWidth = 2;
    const bw = Math.min(w - 24, 520);
    ctx.beginPath();
    ctx.roundRect((w - bw) / 2, y - 18, bw, 36, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.toast.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.fitText(ctx, this.toast.text, w / 2, y, bw - 20, 15, true);
    ctx.globalAlpha = 1;
  }

  private drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, body: string, btnId: string, btnLabel: string) {
    ctx.fillStyle = 'rgba(59,47,34,0.45)';
    ctx.fillRect(0, 0, w, h);
    const cw = Math.min(w - 32, 440);
    const ch = 230;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 20);
    ctx.fill();

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.fitText(ctx, title, w / 2, cy + 40, cw - 32, 22, true);
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = '16px system-ui, sans-serif';
    this.wrapText(ctx, body, w / 2, cy + 82, cw - 40, 22);

    const bw = 180;
    this.addButton(ctx, { id: btnId, x: (w - bw) / 2, y: cy + ch - 72, w: bw, h: 52, label: btnLabel, enabled: true, primary: true });
  }

  private addButton(ctx: CanvasRenderingContext2D, b: Button) {
    // Overlay cards own the input: clear any buttons drawn underneath them.
    if (b.id === 'start' || b.id === 'next' || b.id === 'retry') this.buttons = [];
    this.buttons.push(b);
    ctx.fillStyle = !b.enabled ? COLORS.disabled : b.primary ? COLORS.player : '#FFFFFF';
    ctx.strokeStyle = b.enabled ? COLORS.playerDark : COLORS.disabled;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = b.primary && b.enabled ? '#FFFFFF' : b.enabled ? COLORS.ink : COLORS.inkSoft;
    ctx.font = `bold ${b.label.length <= 1 ? 26 : 17}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, bold: boolean) {
    let s = size;
    ctx.font = `${bold ? 'bold ' : ''}${s}px system-ui, sans-serif`;
    while (s > 10 && ctx.measureText(text).width > maxW) {
      s -= 1;
      ctx.font = `${bold ? 'bold ' : ''}${s}px system-ui, sans-serif`;
    }
    ctx.fillText(text, x, y);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }
}
