import { BaseBusyBoardModule } from './BaseBusyBoardModule';

export class PinwheelHub extends BaseBusyBoardModule {
  public angle = 0; // rotor angle in radians
  public angularVelocity = 0; // radians per second
  private isPointerDown = false;
  private lastPointerAngle = 0;
  private lastPointerTime = 0;
  private readonly bladeColors = [
    '#E74C3C', // Andean Cochineal Red
    '#F39C12', // Warm Sienna Amber
    '#F1C40F', // Sun Gold
    '#2ECC71', // Valley Jade
    '#3498DB', // Indigo Blue
    '#9B59B6', // Highland Violet
  ];
  private lastHapticTickAngle = 0;

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
  }

  public update(dt: number, _px: number, _py: number, _pw: number, _ph: number): void {
    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));

    if (!this.isPointerDown) {
      // Aerodynamic quadratic drag: alpha = -c1*w - c2*w*|w|
      const linearDrag = 0.85;
      const quadraticDrag = 0.035;
      const totalDrag = linearDrag * this.angularVelocity + quadraticDrag * this.angularVelocity * Math.abs(this.angularVelocity);
      this.angularVelocity -= totalDrag * clampedDt;

      // Stop tiny oscillations
      if (Math.abs(this.angularVelocity) < 0.05) {
        this.angularVelocity = 0;
      }
    }

    this.angle += this.angularVelocity * clampedDt;

    // Haptic tick per 60 degree blade revolution when spinning fast enough
    const tickInterval = Math.PI / 3;
    if (Math.abs(this.angle - this.lastHapticTickAngle) >= tickInterval && Math.abs(this.angularVelocity) > 2) {
      this.haptics.lightTap();
      this.lastHapticTickAngle = this.angle;
    }
  }

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const centerX = mx + mw / 2;
    const centerY = my + mh / 2 + 8;
    const rotorRadius = Math.min(mw, mh) * 0.38;

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
    ctx.fillText('052 · PINWHEEL HUB', centerX, my + 12);

    // Speedometer RPM dots indicator
    const speedRatio = Math.min(1, Math.abs(this.angularVelocity) / 30);
    const rpmDots = 5;
    for (let i = 0; i < rpmDots; i++) {
      const active = speedRatio > (i / rpmDots);
      ctx.fillStyle = active ? '#2ECC71' : 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX - 24 + i * 12, my + 30, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Rotor Motion Blur Ring when high RPM
    if (Math.abs(this.angularVelocity) > 12) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, rotorRadius * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(241, 196, 15, ${Math.min(0.4, speedRatio * 0.5)})`;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Pinwheel Blades (6 folded geometric wings)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    const numBlades = 6;
    for (let i = 0; i < numBlades; i++) {
      const bladeAngle = (i * Math.PI * 2) / numBlades;
      ctx.save();
      ctx.rotate(bladeAngle);

      // Primary folded triangular blade
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rotorRadius * 0.45, -rotorRadius * 0.18);
      ctx.lineTo(rotorRadius * 0.92, 0);
      ctx.lineTo(rotorRadius * 0.35, rotorRadius * 0.35);
      ctx.closePath();

      const bladeColor = this.bladeColors[i % this.bladeColors.length];
      const bladeGrad = ctx.createLinearGradient(0, 0, rotorRadius, 0);
      bladeGrad.addColorStop(0, '#FFFFFF');
      bladeGrad.addColorStop(0.3, bladeColor);
      bladeGrad.addColorStop(1, '#1A1A1A');

      ctx.fillStyle = bladeGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Fold highlight crease
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rotorRadius * 0.92, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // 4. Center Brass Axle Cap
    const capRadius = 16;
    const capGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, capRadius);
    capGrad.addColorStop(0, '#FFF5CC');
    capGrad.addColorStop(0.5, '#F39C12');
    capGrad.addColorStop(1, '#7E5109');

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, capRadius, 0, Math.PI * 2);
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.strokeStyle = '#5A3906';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center pivot screw cross
    ctx.strokeStyle = '#3D2503';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;
    const centerX = mx + mw / 2;
    const centerY = my + mh / 2 + 8;
    const rotorRadius = Math.min(mw, mh) * 0.42;

    const dist = Math.hypot(x - centerX, y - centerY);
    // Touch hit area covers entire rotor (well over 44px)
    if (dist <= Math.max(48, rotorRadius)) {
      this.isPointerDown = true;
      this.lastPointerAngle = Math.atan2(y - centerY, x - centerX);
      this.lastPointerTime = performance.now();
      this.haptics.lightTap();
      return true;
    }
    return false;
  }

  public handlePointerMove(x: number, y: number, px: number, py: number, pw: number, ph: number): void {
    if (!this.isPointerDown) return;

    const margin = 10;
    const centerX = px + margin + (pw - margin * 2) / 2;
    const centerY = py + margin + (ph - margin * 2) / 2 + 8;

    const currentPointerAngle = Math.atan2(y - centerY, x - centerX);
    let deltaAngle = currentPointerAngle - this.lastPointerAngle;

    // Handle wrap-around (-PI to PI)
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    const now = performance.now();
    const dt = Math.max(0.008, (now - this.lastPointerTime) / 1000);

    // Set immediate velocity and angle
    this.angularVelocity = deltaAngle / dt;
    this.angle += deltaAngle;

    this.lastPointerAngle = currentPointerAngle;
    this.lastPointerTime = now;
  }

  public handlePointerUp(): void {
    if (this.isPointerDown) {
      this.isPointerDown = false;
      // Clamp terminal impulse
      this.angularVelocity = Math.max(-45, Math.min(45, this.angularVelocity));
      if (Math.abs(this.angularVelocity) > 5) {
        this.haptics.heavyImpact();
        this.audio.play('busyboard:whoosh_air');
      }
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
