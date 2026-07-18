import type { BusyBoardModule } from '../BusyBoardModule';
import { AudioController } from '../../../core/AudioController';
import { HapticController } from '../../../core/HapticController';

export class ArcadeDome implements BusyBoardModule {
  public id: string;
  public x: number;
  public y: number;
  public w: number;
  public h: number;

  private isPressed = false;
  private hasPower = true;
  private audio: AudioController;
  private haptics: HapticController;

  constructor(id: string, x: number, y: number, w: number, h: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
  }

  public init(): void {}

  public setPowerState(hasPower: boolean): void {
    this.hasPower = hasPower;
  }

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const margin = 10;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    // Faceplate (Matte Dark Charcoal)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#1E1E24'; 
    ctx.strokeStyle = '#0F0F12';
    ctx.lineWidth = 3;
    this.roundRect(ctx, mx, my, mw, mh, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Title
    ctx.fillStyle = '#A0A0A5';
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ARCADE DOME', mx + mw / 2, my + 15);
    ctx.restore();

    const centerX = mx + mw / 2;
    const centerY = my + mh / 2 + 10;
    const baseRadius = Math.min(mw, mh) * 0.32;

    // Neon Halo Ring (Glows when pressed)
    if (this.isPressed && this.hasPower) {
      ctx.save();
      ctx.strokeStyle = '#FF007F'; // Vibrant Hot Pink Neon
      ctx.lineWidth = 6;
      ctx.shadowColor = '#FF007F';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = '#441122'; // Dim ring
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Outer black bezel
    ctx.fillStyle = '#08080C';
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner dome button circle
    const domeRadius = baseRadius * 0.82;
    
    ctx.save();
    if (this.isPressed) {
      // Pressed state (flat dome, no shadow offset)
      const domeGrad = ctx.createRadialGradient(centerX, centerY, domeRadius * 0.2, centerX, centerY, domeRadius);
      domeGrad.addColorStop(0, '#FF4DA6'); // Bright neon pink center
      domeGrad.addColorStop(0.8, '#FF007F');
      domeGrad.addColorStop(1, '#8B0046');
      
      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius * 0.94, 0, Math.PI * 2); // Slightly squashed radius
      ctx.fill();

      // Flat bezel shadow overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius * 0.94, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Unpressed state (High 3D rounded dome with light glare)
      // Bottom 3D shadow rim
      ctx.fillStyle = '#8B0046';
      ctx.beginPath();
      ctx.arc(centerX, centerY + 4, domeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Top Dome Gradient
      const domeGrad = ctx.createRadialGradient(centerX - domeRadius * 0.2, centerY - domeRadius * 0.2, domeRadius * 0.1, centerX, centerY, domeRadius);
      domeGrad.addColorStop(0, '#FF80BF'); // Bright pink glare
      domeGrad.addColorStop(0.6, '#FF007F');
      domeGrad.addColorStop(1, '#A30052');
      
      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Glass specular highlight reflection arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius * 0.7, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
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
    const centerY = my + mh / 2 + 10;
    const baseRadius = Math.min(mw, mh) * 0.32;

    // Check hit radius
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    if (dist < baseRadius) {
      this.isPressed = true;
      
      // Feedback: Happy chime synth tone
      this.audio.play('busyboard:arcade_button');
      this.haptics.lightTap();
      return true;
    }

    return false;
  }

  public handlePointerMove(): void {}

  public handlePointerUp(): void {
    if (this.isPressed) {
      this.isPressed = false;
      this.haptics.lightTap();
    }
  }
  
  public destroy(): void {}

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
