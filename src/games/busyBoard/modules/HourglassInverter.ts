import { BaseBusyBoardModule } from './BaseBusyBoardModule';

interface SandGrain {
  x: number; // local x inside chamber (-1 to 1)
  y: number; // local y inside chamber (-1 to 1)
  vx: number;
  vy: number;
  color: string;
}

export class HourglassInverter extends BaseBusyBoardModule {
  public rotation = 0; // 0 (standard) or PI (inverted)
  private targetRotation = 0;
  private isRotating = false;
  private sandGrains: SandGrain[] = [];
  private readonly totalGrains = 120;
  private upperCount = 120; // number of grains currently in top reservoir
  private lowerCount = 0;   // number of grains in bottom reservoir
  private flowAccumulator = 0;
  private readonly sandColors = ['#F9E79F', '#F7DC6F', '#F5B041', '#E59866', '#D4AC0D'];

  constructor(id: string, x: number, y: number, w: number, h: number) {
    super(id, x, y, w, h);
    this.initGrains();
  }

  private initGrains() {
    this.sandGrains = [];
    for (let i = 0; i < this.totalGrains; i++) {
      this.sandGrains.push({
        x: (Math.random() - 0.5) * 0.7,
        y: -0.3 - Math.random() * 0.45,
        vx: 0,
        vy: 0,
        color: this.sandColors[Math.floor(Math.random() * this.sandColors.length)]
      });
    }
  }

  public update(dt: number, _px: number, _py: number, _pw: number, _ph: number): void {
    const safeDt = Number.isFinite(dt) ? dt : 0.016;
    const clampedDt = Math.max(0.001, Math.min(safeDt, 0.05));

    // Smooth rotation interpolation
    if (Math.abs(this.rotation - this.targetRotation) > 0.01) {
      this.isRotating = true;
      this.rotation += (this.targetRotation - this.rotation) * Math.min(1, clampedDt * 8);
    } else {
      this.rotation = this.targetRotation;
      this.isRotating = false;
    }

    // Determine current top vs bottom based on rotation
    const isUpsideDown = Math.cos(this.rotation) < 0;
    const activeTopCount = isUpsideDown ? this.lowerCount : this.upperCount;

    // Stream sand particles through the neck if not in middle of fast flip
    if (activeTopCount > 0 && Math.abs(this.rotation - this.targetRotation) < 0.25) {
      this.flowAccumulator += clampedDt * 18; // grains per second
      while (this.flowAccumulator >= 1 && (isUpsideDown ? this.lowerCount : this.upperCount) > 0) {
        this.flowAccumulator -= 1;
        if (isUpsideDown) {
          this.lowerCount--;
          this.upperCount++;
        } else {
          this.upperCount--;
          this.lowerCount++;
        }

        // Spawn a streaming particle falling through the narrow neck
        const grain = this.sandGrains[Math.floor(Math.random() * this.sandGrains.length)];
        grain.x = (Math.random() - 0.5) * 0.08;
        grain.y = 0; // neck coordinate
        grain.vy = 2.2 + Math.random() * 0.8;
        grain.vx = (Math.random() - 0.5) * 0.4;

        if (Math.random() < 0.1) {
          this.haptics.lightTap();
        }
      }
    }

    // Update falling grains
    for (const grain of this.sandGrains) {
      if (grain.y >= 0 && grain.y < 0.8) {
        grain.y += grain.vy * clampedDt;
        grain.x += grain.vx * clampedDt;
        // Dampen horizontal scatter
        grain.vx *= 0.95;
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
    const centerY = my + mh / 2 + 8;
    const glassWidth = Math.min(mw * 0.52, 110);
    const glassHeight = Math.min(mh * 0.72, 160);

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
    ctx.fillText('054 · HOURGLASS INVERTER', centerX, my + 12);

    // Tap to Invert prompt hint
    ctx.font = '400 11px Fredoka, sans-serif';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('TAP TO FLIP 180°', centerX, my + 28);

    // 2. Rotatable Hourglass Rig
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    // Wooden Frame Posts and Caps
    const postW = glassWidth + 24;
    const postH = glassHeight + 20;

    // Top & Bottom Wood Plates
    ctx.fillStyle = '#8B5A2B';
    ctx.strokeStyle = '#5C3818';
    ctx.lineWidth = 2;

    // Top cap
    this.roundRect(ctx, -postW / 2, -postH / 2, postW, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Bottom cap
    this.roundRect(ctx, -postW / 2, postH / 2 - 14, postW, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Vertical wooden spindle pillars (left & right)
    ctx.fillStyle = '#A0522D';
    this.roundRect(ctx, -postW / 2 + 2, -postH / 2 + 14, 8, postH - 28, 2);
    ctx.fill();
    this.roundRect(ctx, postW / 2 - 10, -postH / 2 + 14, 8, postH - 28, 2);
    ctx.fill();

    // 3. Blown Glass Bulbs (Figure-8 profile with narrow neck)
    const hw = glassWidth / 2;
    const hh = glassHeight / 2;
    const neckW = 10;

    ctx.save();
    ctx.beginPath();
    // Top bulb
    ctx.moveTo(-hw, -hh + 6);
    ctx.bezierCurveTo(-hw, -hh * 0.4, -neckW, -hh * 0.15, -neckW / 2, 0);
    // Bottom bulb
    ctx.bezierCurveTo(-neckW, hh * 0.15, -hw, hh * 0.4, -hw, hh - 6);
    ctx.lineTo(hw, hh - 6);
    ctx.bezierCurveTo(hw, hh * 0.4, neckW, hh * 0.15, neckW / 2, 0);
    ctx.bezierCurveTo(neckW, -hh * 0.15, hw, -hh * 0.4, hw, -hh + 6);
    ctx.closePath();

    // Glass Interior Tint
    ctx.fillStyle = 'rgba(230, 245, 255, 0.12)';
    ctx.fill();

    // 4. Sand Piles in Upper and Lower Bulbs
    // Upper sand pile
    const isUpsideDown = Math.cos(this.rotation) < 0;
    const currentTop = isUpsideDown ? this.lowerCount : this.upperCount;
    const currentBottom = isUpsideDown ? this.upperCount : this.lowerCount;

    if (currentTop > 0) {
      const topRatio = currentTop / this.totalGrains;
      const sandTopY = -hh * (0.2 + topRatio * 0.65);
      ctx.fillStyle = '#F4D03F';
      ctx.beginPath();
      ctx.moveTo(-hw * topRatio * 0.85, sandTopY);
      ctx.lineTo(hw * topRatio * 0.85, sandTopY);
      ctx.lineTo(neckW / 2, -4);
      ctx.lineTo(-neckW / 2, -4);
      ctx.closePath();
      ctx.fill();
    }

    // Lower sand pile (conical mound)
    if (currentBottom > 0) {
      const btmRatio = currentBottom / this.totalGrains;
      const moundHeight = hh * 0.7 * btmRatio;
      const moundWidth = hw * Math.min(1, 0.4 + btmRatio * 0.6);
      ctx.fillStyle = '#F5B041';
      ctx.beginPath();
      ctx.moveTo(-moundWidth, hh - 8);
      ctx.lineTo(0, hh - 8 - moundHeight);
      ctx.lineTo(moundWidth, hh - 8);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Active Streaming Grains
    for (const grain of this.sandGrains) {
      if (grain.y >= 0 && grain.y < 0.75) {
        ctx.fillStyle = grain.color;
        ctx.fillRect(grain.x * (glassWidth * 0.4), grain.y * (glassHeight * 0.5), 3, 3);
      }
    }

    // Glass Outline and Specular Glare Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left curved reflection
    ctx.beginPath();
    ctx.moveTo(-hw * 0.75, -hh + 14);
    ctx.quadraticCurveTo(-hw * 0.8, -hh * 0.4, -neckW * 1.5, -hh * 0.1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
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

    // Minimum hit target 60x80px over the center hourglass
    if (Math.abs(x - centerX) < 55 && Math.abs(y - centerY) < 70) {
      this.flipHourglass();
      return true;
    }
    return false;
  }

  public flipHourglass(): void {
    // Invert target rotation by 180 degrees (PI)
    this.targetRotation += Math.PI;
    this.haptics.heavyImpact();
    this.audio.play('busyboard:sand_flow');
  }

  public override destroy(): void {
    this.sandGrains = [];
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
