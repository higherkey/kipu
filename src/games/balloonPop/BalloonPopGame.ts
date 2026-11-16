import { BaseGame } from '../../core/BaseGame';
import { CelebrationOverlay } from '../../ui/CelebrationOverlay';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface BalloonDot {
  dx: number;
  dy: number;
  radius: number;
}

interface Balloon {
  x: number;
  y: number;
  radius: number;
  color: string;
  pattern: 'dots' | 'stripes' | 'none';
  hits: number;
  maxHits: number;
  velocity: number;
  dots?: BalloonDot[];
}

export class BalloonPopGame extends BaseGame {
  private balloons: Balloon[] = [];
  private particles: Particle[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 1500;
  private popsCount: number = 0;
  private isPaused: boolean = false;

  constructor() {
    super();
    this.audio.registerSound('pop', '/sounds/pop.ogg');
  }

  protected onInit(): void {
    this.balloons = [];
    this.particles = [];
    this.spawnInterval = 1500;
    this.popsCount = 0;
    this.isPaused = false;

    this.canvas?.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas?.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.canvas?.addEventListener('mousedown', this.handleInput);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public resize(width?: number, height?: number): void {
    if (!this.canvas) return;
    if (width !== undefined && height !== undefined) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const currentW = this.canvas.width;
    // Reposition any active balloons that are outside visible bounds after resize
    for (const b of this.balloons) {
      if (b.x > currentW - b.radius) {
        b.x = Math.max(b.radius + 10, currentW - b.radius - 10);
      }
    }
  }

  private readonly handlePointerDown = (e: PointerEvent) => {
    if (this.isPaused || !this.canvas) return;
    if (e.cancelable) e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.checkPop(e.clientX - rect.left, e.clientY - rect.top);
  };

  private readonly handleTouch = (e: TouchEvent) => {
    if (this.isPaused || !this.canvas) return;
    if (e.cancelable) e.preventDefault();
    // If PointerEvent is natively supported, pointerdown handles the event
    if (window.PointerEvent && e.type === 'touchstart') return;
    const rect = this.canvas.getBoundingClientRect();
    Array.from(e.changedTouches).forEach(touch => {
      this.checkPop(touch.clientX - rect.left, touch.clientY - rect.top);
    });
  };

  private readonly handleInput = (e: MouseEvent) => {
    if (this.isPaused || !this.canvas) return;
    if (e.cancelable) e.preventDefault();
    if (window.PointerEvent && (e as any).pointerType !== undefined) return;
    if (window.PointerEvent && !(e instanceof (window as any).PointerEvent)) return;
    const rect = this.canvas.getBoundingClientRect();
    this.checkPop(e.clientX - rect.left, e.clientY - rect.top);
  };

  private checkPop(x: number, y: number) {
    if (this.isPaused) return;
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      const dist = Math.hypot((x - b.x), (y - b.y));
      if (dist < b.radius) {
        b.hits++;
        if (b.hits >= b.maxHits) {
          this.popBalloon(i);
        } else {
          this.audio.play('pop');
          this.haptics.lightTap();
          this.createParticles(b.x, b.y, b.color, 4);
        }
        break;
      }
    }
  }

  private popBalloon(index: number) {
    const b = this.balloons[index];
    this.createParticles(b.x, b.y, b.color, 12);
    this.balloons.splice(index, 1);
    this.audio.play('pop');
    this.haptics.heavyImpact();
    this.popsCount++;
    
    // Milestone celebrations every 10 pops
    if (this.popsCount % 10 === 0) {
      CelebrationOverlay.getInstance().celebrate({
        type: 'stars',
        count: 25,
        x: b.x,
        y: b.y,
      });
    }

    // Difficulty scaling
    if (this.popsCount % 5 === 0) {
      this.spawnInterval = Math.max(400, this.spawnInterval * 0.9);
    }
  }

  private createParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color
      });
    }
  }

  update(dt: number): void {
    if (this.isPaused || !this.canvas || !this.ctx) return;

    // Spawn balloons
    this.spawnTimer += dt;
    if (this.spawnTimer > this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnBalloon();
    }

    // Update balloons
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.y -= b.velocity * (dt / 16);
      if (b.y < -b.radius * 2) {
        this.balloons.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.render();
  }

  private generateBalloonDots(count = 18): BalloonDot[] {
    const dots: BalloonDot[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.508 degrees phyllotaxis
    for (let i = 0; i < count; i++) {
      const theta = i * goldenAngle;
      const r = Math.sqrt((i + 0.5) / count) * 0.72;
      dots.push({
        dx: Math.cos(theta) * r,
        dy: Math.sin(theta) * r,
        radius: 3 + (i % 3) * 0.8
      });
    }
    return dots;
  }

  private spawnBalloon() {
    const types = [
      { color: '#FF5E5E', maxHits: 1, pattern: 'none' as const },
      { color: '#6BCBFF', maxHits: 2, pattern: 'stripes' as const },
      { color: '#FFE66D', maxHits: 3, pattern: 'dots' as const }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const dots = type.pattern === 'dots' ? this.generateBalloonDots() : undefined;

    this.balloons.push({
      x: Math.random() * (this.canvas!.width - 100) + 50,
      y: this.canvas!.height + 100,
      radius: 40 + Math.random() * 20,
      color: type.color,
      pattern: type.pattern,
      hits: 0,
      maxHits: type.maxHits,
      velocity: 2 + Math.random() * 2,
      dots
    });
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw balloons
    this.balloons.forEach(b => {
      this.ctx!.save();
      this.ctx!.beginPath();
      this.ctx!.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx!.fillStyle = b.color;
      this.ctx!.fill();

      // Draw patterns for a11y
      if (b.pattern === 'stripes') {
        this.ctx!.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx!.lineWidth = 5;
        this.ctx!.clip();
        for (let i = -b.radius; i < b.radius * 2; i += 15) {
          this.ctx!.beginPath();
          this.ctx!.moveTo(b.x - b.radius, b.y + i);
          this.ctx!.lineTo(b.x + b.radius, b.y + i - 20);
          this.ctx!.stroke();
        }
      } else if (b.pattern === 'dots') {
        this.ctx!.fillStyle = 'rgba(255, 255, 255, 0.45)';
        if (!b.dots) {
          b.dots = this.generateBalloonDots();
        }
        for (const dot of b.dots) {
          this.ctx!.beginPath();
          this.ctx!.arc(b.x + dot.dx * b.radius, b.y + dot.dy * b.radius, dot.radius, 0, Math.PI * 2);
          this.ctx!.fill();
        }
      }

      this.ctx!.restore();
      this.ctx!.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx!.lineWidth = 2;
      this.ctx!.stroke();
    });

    // Draw particles
    this.particles.forEach(p => {
      this.ctx!.globalAlpha = p.life;
      this.ctx!.fillStyle = p.color;
      this.ctx!.beginPath();
      this.ctx!.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx!.fill();
    });
    this.ctx!.globalAlpha = 1.0;

    // Draw HUD Pop Counter
    if (this.ctx && typeof this.ctx.fillText === 'function') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.font = 'bold 22px Fredoka, sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'top';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(`🎈 ${this.popsCount}`, this.canvas.width - 24, 24);
      this.ctx.restore();
    }
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('touchstart', this.handleTouch);
      this.canvas.removeEventListener('mousedown', this.handleInput);
    }
    this.balloons = [];
    this.particles = [];
  }
}
