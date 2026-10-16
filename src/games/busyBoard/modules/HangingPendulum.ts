import { BaseBusyBoardModule } from './BaseBusyBoardModule';

export class HangingPendulum extends BaseBusyBoardModule {
  // Angular physics: theta (radians), omega (angular velocity), alpha (angular acceleration)
  public theta = 0.5; // initial angle in radians
  public omega = 0;
  private isDragging = false;
  private lengthRatio = 0.52; // relative string length to cell height
  private readonly gravity = 22; // gravity constant for snappy tactile feel
  private readonly damping = 0.988; // air resistance decay per frame
  private lastEquilibriumSign = 1;
  private lastFlickAngle = 0;
  private lastFlickTime = 0;

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
  }

  public update(dt: number, _px: number, _py: number, _pw: number, ph: number): void {
    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));

    if (!this.isDragging) {
      // Non-linear pendulum: alpha = -(g/L) * sin(theta)
      const L = Math.max(80, ph * this.lengthRatio);
      const alpha = - (this.gravity * 80 / L) * Math.sin(this.theta);
      this.omega += alpha * clampedDt;
      this.omega *= Math.pow(this.damping, clampedDt * 60);
      this.theta += this.omega * clampedDt;

      // Detect equilibrium zero-crossing for sound and haptic pulse
      const currentSign = Math.sign(this.theta);
      if (currentSign !== 0 && currentSign !== this.lastEquilibriumSign && Math.abs(this.omega) > 0.3) {
        this.haptics.lightTap();
        this.audio.play('busyboard:pendulum_tick');
        this.lastEquilibriumSign = currentSign;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const pivotX = mx + mw / 2;
    const pivotY = my + 38;
    const armLength = mh * this.lengthRatio;
    const bobRadius = 18; // 36px diameter, touch target is expanded to 48px

    const bobX = pivotX + Math.sin(this.theta) * armLength;
    const bobY = pivotY + Math.cos(this.theta) * armLength;

    // 1. Module Card Background — Andean Stone / Warm Slate
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
    ctx.fillText('051 · HANGING PENDULUM', pivotX, my + 12);

    // Decorative angle arc gauge behind pendulum
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, armLength * 0.9, Math.PI * 0.25, Math.PI * 0.75);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Brass Pivot Bracket
    ctx.fillStyle = '#D4AF37';
    ctx.strokeStyle = '#996515';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(pivotX - 22, pivotY - 10, 44, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4E3629';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Suspension Rod & Joint Links
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Chain links along the rod
    const links = 5;
    for (let i = 1; i < links; i++) {
      const lx = pivotX + (bobX - pivotX) * (i / links);
      const ly = pivotY + (bobY - pivotY) * (i / links);
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Heavy Brass Bob with Specular Reflection
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;

    const bobGrad = ctx.createRadialGradient(
      bobX - bobRadius * 0.35,
      bobY - bobRadius * 0.35,
      bobRadius * 0.1,
      bobX,
      bobY,
      bobRadius
    );
    bobGrad.addColorStop(0, '#FFF6CC');
    bobGrad.addColorStop(0.35, '#F1C40F');
    bobGrad.addColorStop(0.85, '#B7950B');
    bobGrad.addColorStop(1, '#7D6608');

    ctx.fillStyle = bobGrad;
    ctx.strokeStyle = '#5B4804';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bob center jewel
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.arc(bobX, bobY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const pivotX = mx + mw / 2;
    const pivotY = my + 38;
    const armLength = mh * this.lengthRatio;

    const bobX = pivotX + Math.sin(this.theta) * armLength;
    const bobY = pivotY + Math.cos(this.theta) * armLength;

    // Minimum touch hit target 48x48px (radius 24)
    const dist = Math.hypot(x - bobX, y - bobY);
    if (dist <= 36 || (y > pivotY && Math.hypot(x - pivotX, y - pivotY) <= armLength + 30)) {
      this.isDragging = true;
      this.omega = 0;
      this.haptics.lightTap();
      this.lastFlickAngle = this.theta;
      this.lastFlickTime = performance.now();
      this.updateAngleFromPointer(x, y, pivotX, pivotY);
      return true;
    }
    return false;
  }

  public handlePointerMove(x: number, y: number, px: number, py: number, pw: number, _ph: number): void {
    if (!this.isDragging) return;
    const margin = 10;
    const pivotX = px + margin + (pw - margin * 2) / 2;
    const pivotY = py + margin + 38;

    this.updateAngleFromPointer(x, y, pivotX, pivotY);
  }

  public handlePointerUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      const now = performance.now();
      const dt = Math.max(0.016, (now - this.lastFlickTime) / 1000);
      if (dt < 0.2) {
        // Impart flick velocity
        this.omega = (this.theta - this.lastFlickAngle) / dt;
        this.omega = Math.max(-15, Math.min(15, this.omega));
      }
      this.haptics.lightTap();
    }
  }

  private updateAngleFromPointer(x: number, y: number, pivotX: number, pivotY: number): void {
    const dx = x - pivotX;
    const dy = y - pivotY;
    if (dy > 0 || Math.abs(dx) > 10) {
      this.lastFlickAngle = this.theta;
      this.lastFlickTime = performance.now();
      // Constrain swing to +/- 80 degrees (1.4 rad)
      const targetTheta = Math.atan2(dx, Math.max(10, dy));
      this.theta = Math.max(-1.4, Math.min(1.4, targetTheta));
    }
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
