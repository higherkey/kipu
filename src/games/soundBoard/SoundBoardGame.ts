import type { Game } from '../../core/Game';
import { HapticController } from '../../core/HapticController';

interface SoundPad {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  activeColor: string;
  label: string;
  frequency: number;
  waveType: OscillatorType;
  active: number;
}

export class SoundBoardGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private haptics: HapticController;
  private pads: SoundPad[] = [];
  private audioCtx: AudioContext | null = null;
  private paused = false;

  private readonly padConfigs = [
    { color: '#FF5E5E', activeColor: '#FF8A8A', label: 'Boing', frequency: 220, waveType: 'sine' as OscillatorType },
    { color: '#6BCBFF', activeColor: '#9DDEFF', label: 'Buzz', frequency: 150, waveType: 'sawtooth' as OscillatorType },
    { color: '#FFE66D', activeColor: '#FFF0A0', label: 'Beep', frequency: 440, waveType: 'square' as OscillatorType },
    { color: '#4ECDC4', activeColor: '#7EDDD6', label: 'Whoo', frequency: 330, waveType: 'triangle' as OscillatorType },
    { color: '#FF85B3', activeColor: '#FFB0CF', label: 'Zap', frequency: 660, waveType: 'sawtooth' as OscillatorType },
    { color: '#A78BFA', activeColor: '#C4B5FD', label: 'Pop', frequency: 880, waveType: 'sine' as OscillatorType },
    { color: '#34D399', activeColor: '#6EE7B7', label: 'Wub', frequency: 110, waveType: 'square' as OscillatorType },
    { color: '#FB923C', activeColor: '#FDBA74', label: 'Ding', frequency: 523, waveType: 'triangle' as OscillatorType },
    { color: '#F472B6', activeColor: '#F9A8D4', label: 'Boop', frequency: 392, waveType: 'sine' as OscillatorType },
  ];

  constructor() {
    this.haptics = HapticController.getInstance();
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.paused = false;
    this.audioCtx = new AudioContext();
    this.buildGrid();

    canvas.addEventListener('mousedown', this.handleMouse);
    canvas.addEventListener('touchstart', this.handleTouch);
  }

  private buildGrid() {
    if (!this.canvas) return;
    this.pads = [];

    const cols = 3;
    const rows = 3;
    const padding = 16;
    const totalW = this.canvas.width - padding * 2;
    const totalH = this.canvas.height - padding * 2;
    const padW = (totalW - padding * (cols - 1)) / cols;
    const padH = (totalH - padding * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= this.padConfigs.length) break;
        const cfg = this.padConfigs[idx];
        this.pads.push({
          x: padding + c * (padW + padding),
          y: padding + r * (padH + padding),
          width: padW,
          height: padH,
          color: cfg.color,
          activeColor: cfg.activeColor,
          label: cfg.label,
          frequency: cfg.frequency,
          waveType: cfg.waveType,
          active: 0,
        });
      }
    }
  }

  private handleTouch = (e: TouchEvent) => {
    if (this.paused) return;
    Array.from(e.changedTouches).forEach(touch => {
      this.hitTest(touch.clientX, touch.clientY);
    });
  };

  private handleMouse = (e: MouseEvent) => {
    if (this.paused) return;
    this.hitTest(e.clientX, e.clientY);
  };

  private hitTest(x: number, y: number) {
    for (const pad of this.pads) {
      if (
        x >= pad.x && x <= pad.x + pad.width &&
        y >= pad.y && y <= pad.y + pad.height
      ) {
        this.triggerPad(pad);
        break;
      }
    }
  }

  private triggerPad(pad: SoundPad) {
    pad.active = 1.0;
    this.haptics.lightTap();
    this.playTone(pad.frequency, pad.waveType);
  }

  private playTone(frequency: number, waveType: OscillatorType) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

    // Quick pitch sweep for fun effect
    osc.frequency.exponentialRampToValueAtTime(
      frequency * 1.5,
      this.audioCtx.currentTime + 0.1
    );
    osc.frequency.exponentialRampToValueAtTime(
      frequency,
      this.audioCtx.currentTime + 0.2
    );

    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.4);
  }

  update(dt: number): void {
    if (!this.canvas || !this.ctx) return;

    // Fade active states
    for (const pad of this.pads) {
      if (pad.active > 0) {
        pad.active = Math.max(0, pad.active - dt * 0.004);
      }
    }

    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const pad of this.pads) {
      const borderRadius = 20;

      // Glow when active
      if (pad.active > 0) {
        this.ctx.save();
        this.ctx.shadowColor = pad.activeColor;
        this.ctx.shadowBlur = 30 * pad.active;
        this.ctx.fillStyle = pad.activeColor;
        this.roundRect(pad.x, pad.y, pad.width, pad.height, borderRadius);
        this.ctx.fill();
        this.ctx.restore();
      }

      // Pad body
      const lerp = pad.active;
      this.ctx.fillStyle = lerp > 0 ? pad.activeColor : pad.color;
      this.roundRect(pad.x, pad.y, pad.width, pad.height, borderRadius);
      this.ctx.fill();

      // Scale effect when active
      const scale = 1 + pad.active * 0.05;
      const cx = pad.x + pad.width / 2;
      const cy = pad.y + pad.height / 2;

      // Label
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.scale(scale, scale);
      this.ctx.fillStyle = '#2F3061';
      this.ctx.font = `600 ${Math.min(pad.width, pad.height) * 0.2}px Fredoka, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(pad.label, 0, 0);
      this.ctx.restore();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouse);
      this.canvas.removeEventListener('touchstart', this.handleTouch);
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
