import type { Game } from '../../core/Game';

const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];
const NOTES = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];

type Point = { x: number; y: number };
type Cell = Point & { width: number; height: number };

abstract class CanvasMusicGame implements Game {
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected audioContext: AudioContext | null = null;
  protected pressed = new Set<number>();
  protected paused = false;
  protected soundEnabled = true;
  protected cells: Cell[] = [];
  protected focusedCell = -1;
  private timers = new Set<number>();
  protected pointerHandler = (event: PointerEvent) => {
    if (!this.paused) this.handlePointer(event);
  };

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.paused = false;
    this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    canvas.addEventListener('pointerdown', this.pointerHandler);
    this.resize(canvas.width, canvas.height);
    this.render();
  }

  public update(_dt: number): void {
    if (this.paused) return;
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
    this.audioContext = null;
    this.timers.forEach(timer => window.clearTimeout(timer));
    this.timers.clear();
    this.pressed.clear();
    this.canvas?.replaceChildren();
    this.canvas = null;
    this.ctx = null;
  }

  public pause(): void {
    this.paused = true;
    this.audioContext?.suspend().catch(() => {});
  }

  public resume(): void {
    this.paused = false;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (!enabled) this.audioContext?.suspend().catch(() => {});
  }

  protected addControls(labels: string[]): void {
    if (!this.canvas || this.canvas.children.length === labels.length) return;
    this.canvas.replaceChildren(...labels.map((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('focus', () => { this.focusedCell = index; this.render(); });
      button.addEventListener('blur', () => { this.focusedCell = -1; this.render(); });
      button.addEventListener('click', () => {
        if (!this.canvas || this.paused) return;
        const cell = this.cells[index];
        const rect = this.canvas.getBoundingClientRect();
        this.handlePointer({
          clientX: rect.left + (cell.x + cell.width / 2) / this.canvas.width * rect.width,
          clientY: rect.top + (cell.y + cell.height / 2) / this.canvas.height * rect.height,
        } as PointerEvent);
        this.render();
      });
      return button;
    }));
  }

  protected drawFocus(): void {
    const cell = this.cells[this.focusedCell];
    if (!this.ctx || !cell) return;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(cell.x + 3, cell.y + 3, cell.width - 6, cell.height - 6);
  }

  protected flash(cell: number): void {
    this.pressed.add(cell);
    const timer = window.setTimeout(() => {
      this.pressed.delete(cell);
      this.timers.delete(timer);
    }, 180);
    this.timers.add(timer);
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
    if (this.paused || !this.soundEnabled) return;
    const context = this.ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(note, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  protected cellAt(event: PointerEvent): number {
    const rect = this.canvas!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas!.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas!.height;
    return this.cells.findIndex(cell => x >= cell.x && x < cell.x + cell.width && y >= cell.y && y < cell.y + cell.height);
  }

  protected abstract handlePointer(event: PointerEvent): void;
  protected abstract render(): void;
}

export class ToneGardenGame extends CanvasMusicGame {
  private soundSet = 0;

  protected handlePointer(event: PointerEvent): void {
    const cell = this.cellAt(event);
    if (cell < 0) return;
    this.soundSet = Math.floor(cell / 4);
    const note = NOTES[(cell + this.soundSet) % NOTES.length] / (this.soundSet === 3 ? 2 : 1);
    this.playTone(note, 0.35, this.soundSet === 1 || this.soundSet === 2 ? 'triangle' : 'sine');
    this.flash(cell);
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
    this.ctx.fillText('Tap a bloom to make music.', 24, 64);
    const top = 88;
    const gap = 12;
    const size = Math.min((width - 48 - gap * 3) / 4, (height - top - 48 - gap * 3) / 4);
    this.cells = [];
    for (let index = 0; index < 16; index++) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 24 + column * (size + gap);
      const y = top + row * (size + gap);
      this.cells.push({ x, y, width: size, height: size });
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
    this.addControls(Array.from({ length: 16 }, (_, i) => `${['Air', 'Wood', 'Spark', 'Low'][Math.floor(i / 4)]} bloom ${i % 4 + 1}`));
    this.drawFocus();
  }
}

export class PatternLoomGame extends CanvasMusicGame {
  private pattern = Array.from({ length: 32 }, (_, index) => index % 7 === 0 || index % 11 === 0);
  private step = 0;
  private elapsed = 0;
  private bpm = 108;

  public update(dt: number): void {
    if (this.paused) return;
    this.elapsed += dt;
    while (this.elapsed >= 60000 / this.bpm / 2) {
      this.elapsed -= 60000 / this.bpm / 2;
      this.step = (this.step + 1) % 16;
      for (let lane = 0; lane < 2; lane++) {
        if (this.pattern[lane * 16 + this.step]) this.playTone(NOTES[this.step % NOTES.length] / (lane + 1), 0.16, lane === 0 ? 'triangle' : 'sine');
      }
    }
    this.render();
  }

  protected handlePointer(event: PointerEvent): void {
    const cell = this.cellAt(event);
    if (cell < 0) return;
    const index = cell % 16 + Math.floor(cell / 16) * 16;
    this.pattern[index] = !this.pattern[index];
    this.canvas?.children[index]?.setAttribute('aria-pressed', String(this.pattern[index]));
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
    this.ctx.fillText('Tap steps to change your loop.', 24, 64);
    const left = 24;
    const top = 102;
    const columns = width >= 800 ? 16 : width >= 448 ? 8 : 4;
    const cellWidth = (width - 48) / columns;
    const cellHeight = Math.min(70, (height - 150) / (32 / columns) - 14);
    this.cells = [];
    for (let index = 0; index < 32; index++) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = left + column * cellWidth;
      const y = top + row * (cellHeight + 14);
      this.cells.push({ x: x + 2, y, width: cellWidth - 5, height: cellHeight });
      this.ctx.fillStyle = index % 16 === this.step ? '#ffffff' : this.pattern[index] ? COLORS[Math.floor(index / 16) + 3] : '#203544';
      this.ctx.globalAlpha = index % 16 === this.step ? 1 : 0.88;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 2, y, cellWidth - 5, cellHeight, 10);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = '#10131f';
      if (this.pattern[index] || index % 16 === this.step) this.ctx.fillText(String(index % 16 + 1), x + 8, y + 22);
    }
    this.addControls(this.pattern.map((_, i) => `Lane ${Math.floor(i / 16) + 1}, step ${i % 16 + 1}`));
    this.pattern.forEach((on, i) => this.canvas?.children[i]?.setAttribute('aria-pressed', String(on)));
    this.drawFocus();
    this.ctx.fillStyle = '#9bb4c7';
    this.ctx.font = '600 15px system-ui';
    this.ctx.fillText('Two lanes · 16 steps · 108 BPM experiment', 24, height - 28);
  }
}

export class TrackSketcherGame extends CanvasMusicGame {
  private notes: Point[] = [];
  private lastSaved = 0;

  public init(canvas: HTMLCanvasElement): void {
    this.notes = [];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('kipu-track-sketcher-v1') ?? '[]');
      if (Array.isArray(saved)) this.notes = saved.filter((note): note is Point =>
        note !== null && typeof note === 'object' && Number.isFinite(note.x) && Number.isFinite(note.y)
        && note.x >= 0 && note.x <= 1 && note.y >= 0 && note.y <= 1);
    } catch { /* Storage may be blocked or contain a malformed sketch. */ }
    super.init(canvas);
  }

  private save(): void {
    try {
      localStorage.setItem('kipu-track-sketcher-v1', JSON.stringify(this.notes));
      this.lastSaved = performance.now();
    } catch {
      this.lastSaved = 0;
    }
  }

  protected handlePointer(event: PointerEvent): void {
    const rect = this.canvas!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas!.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas!.height;
    const cell = this.cellAt(event);
    if (cell === 0) {
      this.notes = [];
      this.save();
      return;
    }
    if (cell < 1) return;
    const note = { x: (x - 24) / (this.canvas!.width - 48), y: (y - 88) / (this.canvas!.height - 136) };
    this.notes.push(note);
    this.playTone(NOTES[7 - Math.min(7, Math.floor(note.y * 8))], 0.28, 'triangle');
    this.save();
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
    this.ctx.fillText('Tap notes. Your sketch saves here.', 24, 64);
    this.ctx.fillStyle = '#3a3146';
    this.ctx.fillRect(24, 88, width - 48, height - 136);
    for (let row = 1; row < 8; row++) {
      const y = 88 + (height - 136) * row / 8;
      this.ctx.strokeStyle = '#51475e';
      this.ctx.beginPath(); this.ctx.moveTo(24, y); this.ctx.lineTo(width - 24, y); this.ctx.stroke();
    }
    this.notes.forEach((note, index) => {
      this.ctx!.fillStyle = COLORS[index % COLORS.length];
      this.ctx!.beginPath(); this.ctx!.arc(24 + note.x * (width - 48), 88 + note.y * (height - 136), 11, 0, Math.PI * 2); this.ctx!.fill();
    });
    this.ctx.fillStyle = '#c7bfd3';
    this.ctx.font = '600 15px system-ui';
    this.ctx.fillText('Clear sketch', 24, height - 28);
    if (this.lastSaved && performance.now() - this.lastSaved < 1400) this.ctx.fillText('Saved', width - 74, height - 28);
    this.cells = [{ x: 24, y: height - 48, width: 140, height: 44 }];
    const labels = ['Clear sketch'];
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 4; column++) {
        this.cells.push({ x: 24 + column * (width - 48) / 4, y: 88 + row * (height - 136) / 8, width: (width - 48) / 4, height: (height - 136) / 8 });
        labels.push(`Add note ${8 - row} at beat ${column + 1}`);
      }
    }
    this.addControls(labels);
    this.drawFocus();
  }
}
