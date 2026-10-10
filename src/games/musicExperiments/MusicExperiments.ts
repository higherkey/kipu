import type { Game } from '../../core/Game';

const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];
const NOTES = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];

type Point = { x: number; y: number };

abstract class CanvasMusicGame implements Game {
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected audioContext: AudioContext | null = null;
  protected pressed = new Set<number>();
  protected pointerHandler = (event: PointerEvent) => this.handlePointer(event);

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', this.pointerHandler);
    this.resize(canvas.width, canvas.height);
    this.render();
  }

  public update(_dt: number): void {
    this.render();
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  public destroy(): void {
    this.canvas?.removeEventListener('pointerdown', this.pointerHandler);
    this.audioContext?.close().catch(() => {});
    this.canvas = null;
    this.ctx = null;
  }

  protected ensureAudio(): AudioContext | null {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) this.audioContext = new AudioContextClass();
    }
    if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
    return this.audioContext;
  }

  protected playTone(note: number, duration = 0.24, type: OscillatorType = 'sine'): void {
    const context = this.ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(note, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  protected cellAt(event: PointerEvent, columns: number, rows: number): number {
    const rect = this.canvas!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas!.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas!.height;
    const cellWidth = this.canvas!.width / columns;
    const cellHeight = this.canvas!.height / rows;
    const column = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
    return column >= 0 && column < columns && row >= 0 && row < rows ? row * columns + column : -1;
  }

  protected abstract handlePointer(event: PointerEvent): void;
  protected abstract render(): void;
}

export class ToneGardenGame extends CanvasMusicGame {
  private soundSet = 0;

  protected handlePointer(event: PointerEvent): void {
    const cell = this.cellAt(event, 4, 4);
    if (cell < 0) return;
    this.soundSet = Math.floor(cell / 4);
    const note = NOTES[(cell + this.soundSet) % NOTES.length];
    this.playTone(note, 0.35, this.soundSet === 1 ? 'triangle' : this.soundSet === 2 ? 'square' : 'sine');
    this.pressed.add(cell);
    window.setTimeout(() => this.pressed.delete(cell), 180);
  }

  protected render(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    this.ctx.fillStyle = '#10131f';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = '#f4f1de';
    this.ctx.font = '700 24px system-ui';
    this.ctx.fillText('Tone Garden', 24, 38);
    this.ctx.font = '15px system-ui';
    this.ctx.fillStyle = '#aeb6d0';
    this.ctx.fillText('Tap a bloom. Each row changes the sound shape.', 24, 64);
    const top = 88;
    const gap = 12;
    const size = Math.min((width - 48 - gap * 3) / 4, (height - top - 48 - gap * 3) / 4);
    for (let index = 0; index < 16; index++) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 24 + column * (size + gap);
      const y = top + row * (size + gap);
      this.ctx.fillStyle = COLORS[(index + this.soundSet * 2) % COLORS.length];
      this.ctx.globalAlpha = this.pressed.has(index) ? 1 : 0.72;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, size, size, 22);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = '#10131f';
      this.ctx.font = '600 16px system-ui';
      this.ctx.fillText(['Air', 'Wood', 'Spark', 'Low'][Math.floor(index / 4)], x + 14, y + 25);
    }
  }
}

export class PatternLoomGame extends CanvasMusicGame {
  private pattern = Array.from({ length: 32 }, (_, index) => index % 7 === 0 || index % 11 === 0);
  private step = 0;
  private elapsed = 0;
  private bpm = 108;

  public update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed > 60000 / this.bpm / 2) {
      this.elapsed = 0;
      this.step = (this.step + 1) % 32;
      if (this.pattern[this.step]) this.playTone(NOTES[this.step % NOTES.length], 0.16, this.step % 4 === 0 ? 'triangle' : 'sine');
    }
    this.render();
  }

  protected handlePointer(event: PointerEvent): void {
    const cell = this.cellAt(event, 16, 2);
    if (cell < 0) return;
    const index = cell % 16 + Math.floor(cell / 16) * 16;
    this.pattern[index] = !this.pattern[index];
    if (this.pattern[index]) this.playTone(NOTES[index % NOTES.length]);
  }

  protected render(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    this.ctx.fillStyle = '#0c1720';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = '#e7f5ff';
    this.ctx.font = '700 24px system-ui';
    this.ctx.fillText('Pattern Loom', 24, 38);
    this.ctx.font = '15px system-ui';
    this.ctx.fillStyle = '#9bb4c7';
    this.ctx.fillText('Switch steps on and listen for the loop to reveal itself.', 24, 64);
    const left = 24;
    const top = 102;
    const cellWidth = (width - 48) / 16;
    const cellHeight = Math.min(70, (height - 150) / 2);
    for (let index = 0; index < 32; index++) {
      const row = Math.floor(index / 16);
      const column = index % 16;
      const x = left + column * cellWidth;
      const y = top + row * (cellHeight + 14);
      this.ctx.fillStyle = index === this.step ? '#ffffff' : this.pattern[index] ? COLORS[row + 3] : '#203544';
      this.ctx.globalAlpha = index === this.step ? 1 : 0.88;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 2, y, cellWidth - 5, cellHeight, 10);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    this.ctx.fillStyle = '#9bb4c7';
    this.ctx.font = '600 15px system-ui';
    this.ctx.fillText('Two lanes · 16 steps · 108 BPM experiment', 24, height - 28);
  }
}

export class TrackSketcherGame extends CanvasMusicGame {
  private notes: Point[] = [];
  private lastSaved = 0;

  public init(canvas: HTMLCanvasElement): void {
    const saved = localStorage.getItem('kipu-track-sketcher-v1');
    if (saved) {
      try { this.notes = JSON.parse(saved) as Point[]; } catch { this.notes = []; }
    }
    super.init(canvas);
  }

  protected handlePointer(event: PointerEvent): void {
    const rect = this.canvas!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas!.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas!.height;
    if (y < 88) {
      this.notes = [];
      return;
    }
    const note = { x, y };
    this.notes.push(note);
    this.playTone(NOTES[Math.max(0, Math.min(7, Math.floor((this.canvas!.height - y) / (this.canvas!.height / 8))))], 0.28, 'triangle');
    localStorage.setItem('kipu-track-sketcher-v1', JSON.stringify(this.notes));
    this.lastSaved = performance.now();
  }

  protected render(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    this.ctx.fillStyle = '#17151e';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = '#fff4e6';
    this.ctx.font = '700 24px system-ui';
    this.ctx.fillText('Track Sketcher', 24, 38);
    this.ctx.font = '15px system-ui';
    this.ctx.fillStyle = '#c7bfd3';
    this.ctx.fillText('Tap notes onto a timeline. Your sketch autosaves locally.', 24, 64);
    this.ctx.fillStyle = '#3a3146';
    this.ctx.fillRect(24, 88, width - 48, height - 136);
    for (let row = 1; row < 8; row++) {
      const y = 88 + (height - 136) * row / 8;
      this.ctx.strokeStyle = '#51475e';
      this.ctx.beginPath(); this.ctx.moveTo(24, y); this.ctx.lineTo(width - 24, y); this.ctx.stroke();
    }
    this.notes.forEach((note, index) => {
      this.ctx!.fillStyle = COLORS[index % COLORS.length];
      this.ctx!.beginPath(); this.ctx!.arc(note.x, note.y, 11, 0, Math.PI * 2); this.ctx!.fill();
    });
    this.ctx.fillStyle = '#c7bfd3';
    this.ctx.font = '600 15px system-ui';
    this.ctx.fillText('Tap the header to clear', 24, height - 28);
    if (this.lastSaved && performance.now() - this.lastSaved < 1400) this.ctx.fillText('Saved', width - 74, height - 28);
  }
}

export const musicExperimentNames = ['Tone Garden', 'Pattern Loom', 'Track Sketcher'];

export function isMusicExperiment(game: Game): boolean {
  return game instanceof ToneGardenGame || game instanceof PatternLoomGame || game instanceof TrackSketcherGame;
}
