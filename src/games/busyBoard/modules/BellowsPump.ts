import { BaseBusyBoardModule } from './BaseBusyBoardModule';

interface FoamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export class BellowsPump extends BaseBusyBoardModule {
  public compression = 0; // 0 (extended) to 1 (fully compressed)
  private isPressing = false;
  private particles: FoamParticle[] = [];
  private readonly particleColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#34D399'];

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < 28; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 40,
        y: 20 + Math.random() * 30, // resting at bottom of acrylic cylinder
        vx: 0,
        vy: 0,
        radius: 4 + Math.random() * 2.5,
        color: this.particleColors[Math.floor(Math.random() * this.particleColors.length)]
      });
    }
  }

  public update(dt: number, _px: number, _py: number, _pw: number, _ph: number): void {
    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));

    // Spring return on bellows
    if (!this.isPressing && this.compression > 0) {
      this.compression = Math.max(0, this.compression - clampedDt * 3.5);
    }

    // Particle physics inside cylinder (gravity + drag + boundary bouncing)
    const gravity = 180;
    for (const p of this.particles) {
      p.vy += gravity * clampedDt;
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;

      // Air resistance
      p.vx *= 0.96;
      p.vy *= 0.98;

      // Cylinder boundaries
      const tubeHalfW = 28;
      if (p.x < -tubeHalfW + p.radius) {
        p.x = -tubeHalfW + p.radius;
        p.vx = Math.abs(p.vx) * 0.7;
      } else if (p.x > tubeHalfW - p.radius) {
        p.x = tubeHalfW - p.radius;
        p.vx = -Math.abs(p.vx) * 0.7;
      }

      // Floor & Ceiling
      if (p.y > 45) {
        p.y = 45;
        p.vy = -Math.abs(p.vy) * 0.4;
      } else if (p.y < -45) {
        p.y = -45;
        p.vy = Math.abs(p.vy) * 0.5;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const centerX = mx + mw / 2;
    const bellowsX = mx + mw * 0.32;
    const cylinderX = mx + mw * 0.72;
    const centerY = my + mh / 2 + 10;

    // 1. Module Card Frame
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    const bgGrad = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
    bgGrad.addColorStop(0, '#39414D');
    bgGrad.addColorStop(1, '#232931');
    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = '#525E6F';
    ctx.lineWidth = 2.5;

    this.roundRect(ctx, mx, my, mw, mh, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Module Header Badge
    ctx.fillStyle = '#E5E9F0';
    ctx.font = '600 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('057 · BELLOWS PUMP', centerX, my + 12);

    // 2. Air Nozzle Pipe connecting bellows to cylinder
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bellowsX + 22, centerY + 18);
    ctx.lineTo(cylinderX - 30, centerY + 18);
    ctx.stroke();

    // 3. Pleated Accordion Bellows
    const bellowsHeight = 70 * (1 - this.compression * 0.55);
    const bellowsW = 46;
    const pleats = 5;
    const pleatH = bellowsHeight / pleats;

    ctx.save();
    ctx.translate(bellowsX, centerY + 10);

    // Accordion folds
    ctx.beginPath();
    ctx.moveTo(-bellowsW / 2, bellowsHeight / 2);
    for (let i = 0; i < pleats; i++) {
      const py1 = bellowsHeight / 2 - i * pleatH;
      const py2 = py1 - pleatH / 2;
      const py3 = py1 - pleatH;
      const foldOut = (i % 2 === 0) ? 6 : -6;
      ctx.lineTo(-bellowsW / 2 + foldOut, py2);
      ctx.lineTo(-bellowsW / 2, py3);
    }
    ctx.lineTo(bellowsW / 2, -bellowsHeight / 2);
    for (let i = 0; i < pleats; i++) {
      const py1 = -bellowsHeight / 2 + i * pleatH;
      const py2 = py1 + pleatH / 2;
      const py3 = py1 + pleatH;
      const foldOut = (i % 2 === 0) ? -6 : 6;
      ctx.lineTo(bellowsW / 2 + foldOut, py2);
      ctx.lineTo(bellowsW / 2, py3);
    }
    ctx.closePath();

    ctx.fillStyle = '#A0522D';
    ctx.fill();
    ctx.strokeStyle = '#5C3818';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top wooden handle (touch button target >= 44px)
    ctx.fillStyle = '#8B5A2B';
    ctx.beginPath();
    this.roundRect(ctx, -bellowsW / 2 - 4, -bellowsHeight / 2 - 12, bellowsW + 8, 14, 4);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // 4. Transparent Acrylic Cylinder Chamber
    ctx.save();
    ctx.translate(cylinderX, centerY + 10);

    const tubeW = 60;
    const tubeH = 100;

    // Cylinder glass body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, -tubeW / 2, -tubeH / 2, tubeW, tubeH, 12);
    ctx.fill();
    ctx.stroke();

    // Floating Particles inside cylinder
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Specular Reflection highlight on glass tube
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-tubeW / 2 + 6, -tubeH / 2 + 10);
    ctx.lineTo(-tubeW / 2 + 6, tubeH / 2 - 10);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 10;
    const mx = px + margin;
    const mw = pw - margin * 2;
    const bellowsX = mx + mw * 0.32;
    const centerY = py + margin + (ph - margin * 2) / 2 + 10;

    // Minimum hit target >= 48px around bellows handle
    if (Math.abs(x - bellowsX) < 36 && Math.abs(y - (centerY - 20)) < 40) {
      this.isPressing = true;
      this.compressBellows();
      return true;
    }
    return false;
  }

  public handlePointerMove(_x: number, _y: number): void {
    // optional continuous pressure
  }

  public handlePointerUp(): void {
    this.isPressing = false;
  }

  public compressBellows(): void {
    this.compression = 1;
    this.haptics.heavyImpact();
    this.audio.play('busyboard:whoosh_air');

    // Blast air jet into particles
    for (const p of this.particles) {
      p.vy = -260 - Math.random() * 200;
      p.vx = (Math.random() - 0.5) * 120;
    }
  }

  public override destroy(): void {
    this.particles = [];
    super.destroy();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
