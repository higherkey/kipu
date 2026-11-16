import { AudioController } from '../core/AudioController';
import { HapticController } from '../core/HapticController';
import './CelebrationOverlay.css';

export interface CelebrationOptions {
  x?: number;
  y?: number;
  type?: 'confetti' | 'stars' | 'fireworks';
  count?: number;
  message?: string;
  silent?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
  shape: 'rect' | 'star' | 'circle';
  active: boolean;
}

export class CelebrationOverlay {
  private static instance: CelebrationOverlay | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private announcer: HTMLElement | null = null;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  private pool: Particle[] = [];
  private readonly maxParticles = 120;
  private readonly colors = [
    '#FF2A6D', '#05D9E8', '#FFE600', '#00FF66',
    '#D100D1', '#FF7700', '#38BDF8', '#A78BFA',
  ];

  private constructor() {
    this.initPool();
  }

  public static getInstance(): CelebrationOverlay {
    if (!CelebrationOverlay.instance) {
      CelebrationOverlay.instance = new CelebrationOverlay();
    }
    return CelebrationOverlay.instance;
  }

  private initPool(): void {
    this.pool = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        color: '#ffffff',
        alpha: 0,
        decay: 0.02,
        rotation: 0,
        rotSpeed: 0,
        shape: 'rect',
        active: false,
      });
    }
  }

  private ensureMounted(): boolean {
    if (this.canvas && this.canvas.parentElement) {
      this.syncSize();
      return true;
    }

    if (typeof document === 'undefined') return false;

    const parent = document.getElementById('game-container') || document.getElementById('app') || document.body;
    if (!parent) return false;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'celebration-overlay-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');

    this.announcer = document.createElement('div');
    this.announcer.className = 'celebration-announcer';
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');

    parent.appendChild(this.canvas);
    parent.appendChild(this.announcer);

    this.syncSize();
    return true;
  }

  private syncSize(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth || window.innerWidth || 800;
    const height = parent.clientHeight || window.innerHeight || 600;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  public celebrate(options?: CelebrationOptions): void {
    if (!this.ensureMounted()) return;

    const width = this.canvas?.width || 800;
    const height = this.canvas?.height || 600;

    const spawnX = options?.x ?? width / 2;
    const spawnY = options?.y ?? height / 2;
    const type = options?.type ?? 'confetti';
    const count = Math.min(options?.count ?? 50, 80);

    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (p.active) continue;

      p.active = true;
      p.x = spawnX + (Math.random() - 0.5) * 40;
      p.y = spawnY + (Math.random() - 0.5) * 40;
      p.color = this.colors[Math.floor(Math.random() * this.colors.length)];
      p.alpha = 1.0;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 8;

      if (type === 'stars') {
        p.shape = 'star';
        p.size = 12 + Math.random() * 12;
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 240;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.decay = 0.5 + Math.random() * 0.4;
      } else if (type === 'fireworks') {
        p.shape = 'circle';
        p.size = 4 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 300;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.decay = 0.6 + Math.random() * 0.5;
      } else {
        // Confetti default
        p.shape = 'rect';
        p.size = 8 + Math.random() * 8;
        const angle = Math.PI * 1.5 + (Math.random() - 0.5) * 1.2;
        const speed = 180 + Math.random() * 260;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.decay = 0.4 + Math.random() * 0.3;
      }

      spawned++;
    }

    // Audio & Haptics
    if (!options?.silent) {
      try {
        HapticController.getInstance().success();
        AudioController.getInstance().play('synth:bell', 'C5');
      } catch {
        // Safe fallback in headless / test environments
      }
    }

    // Accessible Announcement
    if (this.announcer) {
      this.announcer.textContent = options?.message || 'Goal completed! Great job!';
    }

    // Start RAF loop if not active
    if (!this.animFrameId) {
      this.lastTime = performance.now();
      this.animFrameId = requestAnimationFrame(this.renderLoop);
    }
  }

  private renderLoop = (time: number): void => {
    const dtSec = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.updateAndRender(dtSec);

    const hasActive = this.pool.some(p => p.active);
    if (hasActive) {
      this.animFrameId = requestAnimationFrame(this.renderLoop);
    } else {
      this.animFrameId = null;
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };

  public updateAndRender(dtSec: number): void {
    const canvasH = this.canvas?.height || 600;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const gravity = 320;

    for (const p of this.pool) {
      if (!p.active) continue;

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += gravity * dtSec;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed * dtSec;
      p.alpha -= p.decay * dtSec;

      if (p.alpha <= 0 || p.y > canvasH + 50) {
        p.active = false;
        continue;
      }

      if (this.ctx && typeof this.ctx.save === 'function') {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillStyle = p.color;
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);

        if (p.shape === 'star') {
          this.drawStar(this.ctx, 0, 0, 5, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          this.ctx.fill();
        } else {
          // Rect / flutter ribbon
          this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }

        this.ctx.restore();
      }
    }
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    if (typeof ctx.beginPath === 'function') ctx.beginPath();
    if (typeof ctx.moveTo === 'function') ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      if (typeof ctx.lineTo === 'function') ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      if (typeof ctx.lineTo === 'function') ctx.lineTo(x, y);
      rot += step;
    }
    if (typeof ctx.lineTo === 'function') ctx.lineTo(cx, cy - outerRadius);
    if (typeof ctx.closePath === 'function') ctx.closePath();
    if (typeof ctx.fill === 'function') ctx.fill();
  }

  public clear(): void {
    for (const p of this.pool) {
      p.active = false;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public getActiveCount(): number {
    return this.pool.filter(p => p.active).length;
  }

  public destroy(): void {
    this.clear();
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
    if (this.announcer) {
      this.announcer.remove();
      this.announcer = null;
    }
  }
}
