import { BaseBusyBoardModule } from './BaseBusyBoardModule';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface Peg {
  x: number;
  y: number;
  radius: number;
}

export class PlinkoFunnel extends BaseBusyBoardModule {
  public funnelXRatio = 0.5; // normalized funnel position (0.1 to 0.9)
  private isDraggingFunnel = false;
  private balls: Ball[] = [];
  private pegs: Peg[] = [];
  private setupDone = false;
  private lastDropTime = 0;
  private readonly maxBalls = 10;
  private bins = [0, 0, 0, 0, 0]; // 5 collection score bins

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
  }

  private setupPegs(mx: number, my: number, mw: number, mh: number) {
    this.pegs = [];
    const startY = my + 80;
    const endY = my + mh - 55;
    const rows = 4;
    const pegYSpacing = (endY - startY) / (rows - 1);

    for (let r = 0; r < rows; r++) {
      const colsInRow = (r % 2 === 0) ? 6 : 5;
      const xMargin = (r % 2 === 0) ? mw * 0.15 : mw * 0.22;
      const xSpacing = (mw - xMargin * 2) / (colsInRow - 1);
      const py = startY + r * pegYSpacing;

      for (let c = 0; c < colsInRow; c++) {
        const px = mx + xMargin + c * xSpacing;
        this.pegs.push({ x: px, y: py, radius: 4.5 });
      }
    }
  }

  public update(dt: number, px: number, py: number, pw: number, ph: number): void {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    if (!this.setupDone) {
      this.setupPegs(mx, my, mw, mh);
      this.setupDone = true;
    }

    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));
    const gravity = 480; // pixels / s^2
    const restitution = 0.62; // peg bounciness
    const binY = my + mh - 35;
    const safeMw = Math.max(1, mw);

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.vy += gravity * clampedDt;
      b.x += b.vx * clampedDt;
      b.y += b.vy * clampedDt;

      // Peg collisions
      for (const peg of this.pegs) {
        const dx = b.x - peg.x;
        const dy = b.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b.radius + peg.radius;

        if (dist < minDist) {
          // Safe normal vector to prevent tunneling or NaN when dist is zero
          const safeDist = dist > 0.001 ? dist : 0.001;
          const nx = dist > 0.001 ? dx / safeDist : 0;
          const ny = dist > 0.001 ? dy / safeDist : -1;

          // Push ball outside peg
          b.x = peg.x + nx * minDist;
          b.y = peg.y + ny * minDist;

          // Reflect velocity along normal with restitution + small random deflection
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx = (b.vx - 2 * dot * nx) * restitution + (Math.random() - 0.5) * 40;
            b.vy = (b.vy - 2 * dot * ny) * restitution;
            this.haptics.lightTap();
            this.audio.play('busyboard:chime_peg');
          }
        }
      }

      // Side wall bounces
      if (b.x - b.radius < mx + 8) {
        b.x = mx + 8 + b.radius;
        b.vx = Math.abs(b.vx) * restitution;
      } else if (b.x + b.radius > mx + mw - 8) {
        b.x = mx + mw - 8 - b.radius;
        b.vx = -Math.abs(b.vx) * restitution;
      }

      // Bottom bin landing
      if (b.y >= binY) {
        const binIndex = Math.max(0, Math.min(4, Math.floor(((b.x - mx) / safeMw) * 5)));
        this.bins[binIndex]++;
        this.haptics.lightTap();
        this.balls.splice(i, 1);
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
    const funnelY = my + 44;
    const currentFunnelX = mx + mw * this.funnelXRatio;

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
    ctx.fillText('055 · PLINKO FUNNEL SLIDE', centerX, my + 10);

    // 2. Funnel Slide Rail Track
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mx + 20, funnelY);
    ctx.lineTo(mx + mw - 20, funnelY);
    ctx.stroke();

    // 3. Sliding Funnel Dropper
    ctx.save();
    ctx.translate(currentFunnelX, funnelY);

    // Funnel shape
    ctx.fillStyle = '#E67E22';
    ctx.strokeStyle = '#B95E0D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.lineTo(18, -12);
    ctx.lineTo(8, 14);
    ctx.lineTo(-8, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Drop trigger button (touch target >= 44px)
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#27AE60';
    ctx.stroke();

    ctx.restore();

    // 4. Staggered Brass Pegs
    for (const peg of this.pegs) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);

      const pegGrad = ctx.createRadialGradient(
        peg.x - 1,
        peg.y - 1,
        1,
        peg.x,
        peg.y,
        peg.radius
      );
      pegGrad.addColorStop(0, '#FFF5CC');
      pegGrad.addColorStop(0.5, '#F1C40F');
      pegGrad.addColorStop(1, '#9A7D0A');
      ctx.fillStyle = pegGrad;
      ctx.fill();
      ctx.strokeStyle = '#7D6608';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Active Falling Balls
    for (const b of this.balls) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      const bGrad = ctx.createRadialGradient(
        b.x - b.radius * 0.3,
        b.y - b.radius * 0.3,
        b.radius * 0.1,
        b.x,
        b.y,
        b.radius
      );
      bGrad.addColorStop(0, '#FFFFFF');
      bGrad.addColorStop(0.4, b.color);
      bGrad.addColorStop(1, '#2C3E50');
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.restore();
    }

    // 6. Bottom Collection Bins with Counts
    const binW = mw / 5;
    const binY = my + mh - 35;
    for (let i = 0; i < 5; i++) {
      const bx = mx + i * binW;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, binY);
      ctx.lineTo(bx, binY + 25);
      ctx.stroke();

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.bins[i]}`, bx + binW / 2, binY + 12);
    }

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, _ph: number): boolean {
    const margin = 10;
    const mx = px + margin;
    const mw = pw - margin * 2;
    const currentFunnelX = mx + mw * this.funnelXRatio;
    const funnelY = py + margin + 44;

    // Minimum touch target 48x48px around funnel dropper
    if (Math.abs(x - currentFunnelX) < 32 && Math.abs(y - funnelY) < 32) {
      this.isDraggingFunnel = true;
      this.dropBall(currentFunnelX, funnelY + 16);
      return true;
    }

    // Tapping elsewhere on the top track repositions and drops
    if (y >= py && y <= py + 75) {
      this.isDraggingFunnel = true;
      const safeMw = Math.max(1, mw);
      this.funnelXRatio = Math.max(0.1, Math.min(0.9, (x - mx) / safeMw));
      this.dropBall(mx + mw * this.funnelXRatio, funnelY + 16);
      return true;
    }

    return false;
  }

  public handlePointerMove(x: number, _y: number, px: number, _py: number, pw: number, _ph: number): void {
    if (!this.isDraggingFunnel) return;
    const margin = 10;
    const mx = px + margin;
    const mw = pw - margin * 2;
    const safeMw = Math.max(1, mw);
    this.funnelXRatio = Math.max(0.1, Math.min(0.9, (x - mx) / safeMw));
  }

  public handlePointerUp(): void {
    this.isDraggingFunnel = false;
  }

  public override destroy(): void {
    this.balls = [];
    this.pegs = [];
    super.destroy();
  }

  public dropBall(spawnX: number, spawnY: number): void {
    const now = performance.now();
    if (now - this.lastDropTime < 140 || this.balls.length >= this.maxBalls) return;
    this.lastDropTime = now;

    const ballColors = ['#E74C3C', '#3498DB', '#F1C40F', '#9B59B6', '#1ABC9C'];
    this.balls.push({
      x: spawnX,
      y: spawnY,
      vx: (Math.random() - 0.5) * 20,
      vy: 10,
      radius: 8,
      color: ballColors[Math.floor(Math.random() * ballColors.length)]
    });

    this.haptics.lightTap();
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
