import type { BusyBoardModule } from '../BusyBoardModule';
import type { LuminaryBoardGame } from '../LuminaryBoardGame';
import { AudioController } from '../../../core/AudioController';
import { HapticController } from '../../../core/HapticController';

export class ColorSlider implements BusyBoardModule {
  public id: string;
  public x: number;
  public y: number;
  public w: number;
  public h: number;
  private channel: 'r' | 'g' | 'b';
  private game: LuminaryBoardGame;
  private value = 0.5; // 0.0 to 1.0
  private isDragging = false;
  private audio: AudioController;
  private haptics: HapticController;
  private lastTickValue = 0.5;

  constructor(id: string, x: number, y: number, w: number, h: number, game: LuminaryBoardGame) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.game = game;
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    
    // Map ID to channel
    if (id === '012') this.channel = 'r';
    else if (id === '013') this.channel = 'g';
    else this.channel = 'b';
  }

  public init(): void {
    // Set initial value in game
    this.game.updateRGB(this.channel, this.value);
  }

  public render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const theme = this.game.getTheme();
    const margin = 12;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    // Outer faceplate
    ctx.save();
    ctx.shadowColor = theme === 'paper' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 0, 128, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    if (theme === 'paper') {
      ctx.fillStyle = '#FAF8F5';
      ctx.strokeStyle = '#D5C3A6';
    } else {
      ctx.fillStyle = '#1A1D24';
      ctx.strokeStyle = this.getColorHex();
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
      ctx.fillStyle = this.getColorHex();
      ctx.shadowColor = this.getColorHex();
      ctx.shadowBlur = 4;
    }
    ctx.fillText(`${this.getChannelName().toUpperCase()} FADER`, mx + mw / 2, my + 12);
    ctx.restore();

    // Slider track
    const trackX = mx + mw / 2;
    const trackStartY = my + mh * 0.25;
    const trackEndY = my + mh * 0.85;
    const trackHeight = trackEndY - trackStartY;

    ctx.save();
    // Track gradient showing intensity
    const trackGrad = ctx.createLinearGradient(trackX, trackEndY, trackX, trackStartY);
    trackGrad.addColorStop(0, '#000000');
    trackGrad.addColorStop(1, this.getColorHex());

    ctx.strokeStyle = trackGrad;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trackX, trackStartY);
    ctx.lineTo(trackX, trackEndY);
    ctx.stroke();
    ctx.restore();

    // Slider knob/handle
    const knobY = trackEndY - this.value * trackHeight;
    const knobR = 14;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(trackX, knobY, knobR, 0, Math.PI * 2);
    if (theme === 'paper') {
      ctx.fillStyle = '#EAE6DF';
      ctx.strokeStyle = '#BCAE97';
    } else {
      ctx.fillStyle = '#282D37';
      ctx.strokeStyle = this.getColorHex();
    }
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // Inside grip line
    ctx.beginPath();
    ctx.moveTo(trackX - 6, knobY);
    ctx.lineTo(trackX + 6, knobY);
    ctx.strokeStyle = theme === 'paper' ? '#4A473E' : '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean {
    const margin = 12;
    const mx = px + margin;
    const my = py + margin;
    const mw = pw - margin * 2;
    const mh = ph - margin * 2;

    const trackX = mx + mw / 2;
    const trackStartY = my + mh * 0.25;
    const trackEndY = my + mh * 0.85;
    const trackHeight = trackEndY - trackStartY;

    const knobY = trackEndY - this.value * trackHeight;

    // Check distance to knob
    const dx = x - trackX;
    const dy = y - knobY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 25) {
      this.isDragging = true;
      this.haptics.lightTap();
      return true;
    }
    return false;
  }

  public handlePointerMove(_x: number, y: number, _px: number, py: number, _pw: number, ph: number): void {
    if (!this.isDragging) return;

    const margin = 12;
    const my = py + margin;
    const mh = ph - margin * 2;

    const trackStartY = my + mh * 0.25;
    const trackEndY = my + mh * 0.85;
    const trackHeight = trackEndY - trackStartY;

    // Calculate pct
    let pct = (trackEndY - y) / trackHeight;
    pct = Math.max(0, Math.min(1, pct));

    this.value = pct;
    this.game.updateRGB(this.channel, this.value);

    // Play scroll clicks
    if (Math.abs(this.value - this.lastTickValue) >= 0.08) {
      const pitch = 200 + this.value * 300;
      this.audio.play('synth:click', pitch);
      this.haptics.lightTap();
      this.lastTickValue = this.value;
    }
  }

  public handlePointerUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.audio.play('synth:click', 400);
    }
  }

  public destroy(): void {}

  private getColorHex(): string {
    if (this.channel === 'r') return '#FF2D55';
    if (this.channel === 'g') return '#4CD964';
    return '#007AFF';
  }

  private getChannelName(): string {
    if (this.channel === 'r') return 'red';
    if (this.channel === 'g') return 'green';
    return 'blue';
  }

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
