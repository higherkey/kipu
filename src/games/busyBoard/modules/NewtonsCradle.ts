import { BaseBusyBoardModule } from './BaseBusyBoardModule';

interface CradleBall {
  theta: number; // angle in radians
  omega: number; // angular velocity
  radius: number;
}

export class NewtonsCradle extends BaseBusyBoardModule {
  public balls: CradleBall[] = [];
  private readonly numBalls = 5;
  private isDragging = false;
  private dragIndex = -1;
  private readonly stringLengthRatio = 0.55;
  private lastClickTime = 0;

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
    this.initBalls();
  }

  private initBalls() {
    this.balls = [];
    for (let i = 0; i < this.numBalls; i++) {
      this.balls.push({
        theta: 0,
        omega: 0,
        radius: 12
      });
    }
    // Start with 1 ball deflected to show kinetic motion immediately
    this.balls[0].theta = -0.55;
  }

  public update(dt: number, _px: number, _py: number, _pw: number, ph: number): void {
    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));
    const L = Math.max(70, ph * this.stringLengthRatio);
    const gravity = 28;
    const damping = 0.992;

    // 1. Independent harmonic oscillation
    for (let i = 0; i < this.numBalls; i++) {
      if (this.isDragging && i === this.dragIndex) continue;

      const b = this.balls[i];
      const alpha = -(gravity * 80 / L) * Math.sin(b.theta);
      b.omega += alpha * clampedDt;
      b.omega *= Math.pow(damping, clampedDt * 60);
      b.theta += b.omega * clampedDt;
    }

    // 2. Elastic Collision Momentum Transfer between adjacent spheres
    // With spaced suspension pivots, spheres collide when angular positions overlap (b1.theta >= b2.theta)
    for (let i = 0; i < this.numBalls - 1; i++) {
      const b1 = this.balls[i];
      const b2 = this.balls[i + 1];

      // Collision threshold: when b1 moves into b2
      if (b1.theta > b2.theta && b1.omega > b2.omega) {
        // Equal mass elastic collision: swap velocities
        const temp = b1.omega;
        b1.omega = b2.omega;
        b2.omega = temp;

        // Position separation
        b1.theta = b2.theta;

        const now = performance.now();
        if (now - this.lastClickTime > 70 && Math.abs(temp) > 0.4) {
          this.lastClickTime = now;
          this.haptics.heavyImpact();
          this.audio.play('busyboard:metal_clack');
        }
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
    const topBarY = my + 44;
    const stringLength = mh * this.stringLengthRatio;
    const ballSpacing = 24;
    const totalSpan = (this.numBalls - 1) * ballSpacing;
    const startX = centerX - totalSpan / 2;

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
    ctx.fillText("058 · NEWTON'S CRADLE", centerX, my + 12);

    // 2. Stainless Steel Suspension Bar
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX - 20, topBarY);
    ctx.lineTo(startX + totalSpan + 20, topBarY);
    ctx.stroke();

    // Mounting nuts
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(startX - 18, topBarY, 4, 0, Math.PI * 2);
    ctx.arc(startX + totalSpan + 18, topBarY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 3. Spheres and Monofilament Cords
    for (let i = 0; i < this.numBalls; i++) {
      const pivotX = startX + i * ballSpacing;
      const b = this.balls[i];
      const bobX = pivotX + Math.sin(b.theta) * stringLength;
      const bobY = topBarY + Math.cos(b.theta) * stringLength;

      // Cord
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, topBarY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      // Chrome reflective sphere
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      const sphereGrad = ctx.createRadialGradient(
        bobX - b.radius * 0.35,
        bobY - b.radius * 0.35,
        b.radius * 0.1,
        bobX,
        bobY,
        b.radius
      );
      sphereGrad.addColorStop(0, '#FFFFFF');
      sphereGrad.addColorStop(0.35, '#E2E8F0');
      sphereGrad.addColorStop(0.75, '#64748B');
      sphereGrad.addColorStop(1, '#1E293B');

      ctx.fillStyle = sphereGrad;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bobX, bobY, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const centerX = mx + mw / 2;
    const topBarY = my + 44;
    const stringLength = mh * this.stringLengthRatio;
    const ballSpacing = 24;
    const totalSpan = (this.numBalls - 1) * ballSpacing;
    const startX = centerX - totalSpan / 2;

    // Check hit target for each ball (expanded to 44px)
    for (let i = 0; i < this.numBalls; i++) {
      const pivotX = startX + i * ballSpacing;
      const b = this.balls[i];
      const bobX = pivotX + Math.sin(b.theta) * stringLength;
      const bobY = topBarY + Math.cos(b.theta) * stringLength;

      if (Math.hypot(x - bobX, y - bobY) <= 24) {
        this.isDragging = true;
        this.dragIndex = i;
        b.omega = 0;
        this.haptics.lightTap();
        this.updateDragTheta(x, pivotX, topBarY);
        return true;
      }
    }

    // General tap near sides pulls outer balls
    if (y > topBarY + 20) {
      if (x < centerX - totalSpan / 2) {
        this.isDragging = true;
        this.dragIndex = 0;
        this.updateDragTheta(x, startX, topBarY);
        return true;
      } else if (x > centerX + totalSpan / 2) {
        this.isDragging = true;
        this.dragIndex = this.numBalls - 1;
        this.updateDragTheta(x, startX + totalSpan, topBarY);
        return true;
      }
    }

    return false;
  }

  public handlePointerMove(x: number, _y: number, px: number, py: number, pw: number, _ph: number): void {
    if (!this.isDragging || this.dragIndex === -1) return;

    const margin = 10;
    const mx = px + margin;
    const mw = pw - margin * 2;
    const centerX = mx + mw / 2;
    const topBarY = py + margin + 44;
    const ballSpacing = 24;
    const startX = centerX - ((this.numBalls - 1) * ballSpacing) / 2;
    const pivotX = startX + this.dragIndex * ballSpacing;

    this.updateDragTheta(x, pivotX, topBarY);
  }

  public handlePointerUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragIndex = -1;
      this.haptics.lightTap();
    }
  }

  private updateDragTheta(pointerX: number, pivotX: number, _topBarY: number): void {
    if (this.dragIndex === -1) return;
    const dx = pointerX - pivotX;
    // Constrain deflection to +/- 1.1 rad (~63 degrees)
    this.balls[this.dragIndex].theta = Math.max(-1.1, Math.min(1.1, dx / 70));
  }

  public override destroy(): void {
    this.balls = [];
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
