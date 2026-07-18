import type { BusyBoardModule } from '../BusyBoardModule';
import type { LuminaryBoardGame } from '../LuminaryBoardGame';
import { AudioController } from '../../../core/AudioController';
import { HapticController } from '../../../core/HapticController';

export class RGBCanvasBlock implements BusyBoardModule {
  public id: string;
  public x: number;
  public y: number;
  public w: number;
  public h: number;
  private game: LuminaryBoardGame;

  private audio: AudioController;
  private haptics: HapticController;

  constructor(id: string, x: number, y: number, w: number, h: number, game: LuminaryBoardGame) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.game = game;
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
  }

  public init(): void {}

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const theme = this.game.getTheme();
    const margin = 12;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const centerX = mx + mw / 2;
    const centerY = my + mh / 2 + 10;

    // Faceplate
    ctx.save();
    ctx.shadowColor = theme === 'paper' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 255, 204, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    if (theme === 'paper') {
      ctx.fillStyle = '#FAF8F5';
      ctx.strokeStyle = '#D5C3A6';
    } else {
      ctx.fillStyle = '#1A1D24';
      ctx.strokeStyle = '#00FFCC';
    }
    ctx.lineWidth = 3;
    this.roundRect(ctx, mx, my, mw, mh, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.restore();

    // Title
    ctx.save();
    ctx.font = 'bold 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (theme === 'paper') {
      ctx.fillStyle = '#5A564C';
    } else {
      ctx.fillStyle = '#00FFCC';
      ctx.shadowColor = '#00FFCC';
      ctx.shadowBlur = 4;
    }
    ctx.fillText('RGB CENTRAL LIGHT', centerX, my + 12);
    ctx.restore();

    // --- DRAW CENTRAL LIGHT BULB / DOME ---
    const rgb = this.game.getRGB();
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    const mixedColor = `rgb(${r}, ${g}, ${b})`;

    ctx.save();
    
    // Light bulb base/casing
    const casingY = centerY + 30;
    ctx.fillStyle = theme === 'paper' ? '#8C8578' : '#333333';
    ctx.fillRect(centerX - 24, casingY, 48, 12);
    ctx.fillRect(centerX - 18, casingY + 12, 36, 6);

    // Glowing aura behind the bulb
    const glowRad = 70;
    const bulbGlow = ctx.createRadialGradient(
      centerX, centerY - 10, 5,
      centerX, centerY - 10, glowRad
    );
    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    bulbGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.1 + brightness * 0.7})`);
    bulbGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bulbGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 10, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // The Glass Dome Bulb itself
    const bulbRadius = 38;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 10, bulbRadius, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(centerX + 20, casingY);
    ctx.lineTo(centerX - 20, casingY);
    ctx.closePath();

    // Solid/semi-translucent fill
    ctx.fillStyle = mixedColor;
    ctx.fill();

    // Glass sheen / highlight overlay
    const sheenGrad = ctx.createLinearGradient(
      centerX - bulbRadius, centerY - 10 - bulbRadius,
      centerX + bulbRadius, centerY - 10 + bulbRadius
    );
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    sheenGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    sheenGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 10, bulbRadius, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(centerX + 20, casingY);
    ctx.lineTo(centerX - 20, casingY);
    ctx.closePath();
    ctx.fill();

    // Dome outer metallic rim
    ctx.strokeStyle = theme === 'paper' ? '#5A564C' : '#66FCF1';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Inner Filament
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY + 15);
    ctx.lineTo(centerX - 6, centerY - 10);
    ctx.lineTo(centerX + 6, centerY - 10);
    ctx.lineTo(centerX + 10, centerY + 15);
    ctx.strokeStyle = theme === 'paper' ? 'rgba(90, 86, 76, 0.6)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Electrical arcs/sparkles if brightness is very high
    if (brightness > 0.85) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startDist = bulbRadius + 4;
        const endDist = startDist + Math.random() * 12;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * startDist, centerY - 10 + Math.sin(angle) * startDist);
        const midX = centerX + Math.cos(angle) * (startDist + endDist) / 2 + (Math.random() - 0.5) * 6;
        const midY = centerY - 10 + Math.sin(angle) * (startDist + endDist) / 2 + (Math.random() - 0.5) * 6;
        ctx.lineTo(midX, midY);
        ctx.lineTo(centerX + Math.cos(angle) * endDist, centerY - 10 + Math.sin(angle) * endDist);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 12;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const centerX = mx + mw / 2;
    const centerY = my + mh / 2 + 10;
    const bulbRadius = 38;

    const dist = Math.hypot(x - centerX, y - (centerY - 10));
    if (dist <= bulbRadius) {
      const rgb = this.game.getRGB();
      const brightness = (rgb.r + rgb.g + rgb.b) / 3;
      this.audio.play('synth:bell', 300 + brightness * 600);
      this.haptics.lightTap();
      return true;
    }
    return false;
  }

  public handlePointerMove(_x: number, _y: number, _px: number, _py: number, _pw: number, _ph: number): void {}

  public handlePointerUp(): void {}

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
