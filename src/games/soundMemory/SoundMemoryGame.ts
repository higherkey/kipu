import { BaseGame } from '../../core/BaseGame';

interface SoundButton {
  id: number;
  label: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  isActive: boolean;
  instrument: string;
  note: string;
}

type GamePhase = 'ready' | 'show' | 'wait' | 'play' | 'won' | 'lost';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
}

/**
 * Yuyay (Sound Memory): Andean auditory pattern recognition.
 * Players listen to and repeat the sequence of melodic tones.
 */
export class SoundMemoryGame extends BaseGame {
  private buttons: SoundButton[] = [];
  private particles: Particle[] = [];

  private readonly sequence: number[] = [];
  private playerSequence: number[] = [];
  private phase: GamePhase = 'ready';
  private level = 0;
  private readonly highlightDuration = 380; // ms per highlight
  private activeTimeouts: ReturnType<typeof setTimeout>[] = [];
  private isPaused = false;

  protected onInit(): void {
    this.activeTimeouts = [];
    this.particles = [];

    this.createButtons();
    this.startNewRound();

    this.canvas?.addEventListener('pointerdown', this.handlePointerDown);
    // Backward compatibility for environments without pointer events
    this.canvas?.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.canvas?.addEventListener('mousedown', this.handleMouseDown);
  }

  public resize(_width?: number, _height?: number): void {
    if (!this.canvas) return;
    this.createButtons();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  private createButtons() {
    if (!this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerX = w / 2;
    const centerY = h / 2 + 10;
    const minDim = Math.min(w, h);

    // Responsive radius: clamped between 48px and 78px
    const radius = Math.max(48, Math.min(78, minDim * 0.16));
    // Spacing scales dynamically to never overflow viewport
    const spacingX = Math.max(radius + 15, Math.min(145, (w / 2) - radius - 20));
    const spacingY = Math.max(radius + 15, Math.min(135, (h / 2) - radius - 55));

    const existingStates = new Map<number, boolean>();
    this.buttons.forEach(b => existingStates.set(b.id, b.isActive));

    this.buttons = [
      {
        id: 0,
        label: 'Do',
        color: '#E05353', // Warm Andean Cochineal Red
        x: centerX - spacingX,
        y: centerY - spacingY,
        radius,
        isActive: existingStates.get(0) ?? false,
        instrument: 'bell',
        note: 'C4'
      },
      {
        id: 1,
        label: 'Re',
        color: '#2E86AB', // Andean Sky Blue
        x: centerX + spacingX,
        y: centerY - spacingY,
        radius,
        isActive: existingStates.get(1) ?? false,
        instrument: 'bell',
        note: 'D4'
      },
      {
        id: 2,
        label: 'Mi',
        color: '#F6BD60', // Warm Ochre Sun
        x: centerX - spacingX,
        y: centerY + spacingY,
        radius,
        isActive: existingStates.get(2) ?? false,
        instrument: 'bell',
        note: 'E4'
      },
      {
        id: 3,
        label: 'Sol',
        color: '#588157', // High Sierra Sage
        x: centerX + spacingX,
        y: centerY + spacingY,
        radius,
        isActive: existingStates.get(3) ?? false,
        instrument: 'bell',
        note: 'G4'
      }
    ];
  }

  private setGameTimeout(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.activeTimeouts = this.activeTimeouts.filter(t => t !== timer);
      if (!this.isPaused) {
        callback();
      }
    }, delay);
    this.activeTimeouts.push(timer);
    return timer;
  }

  private clearAllTimeouts() {
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts = [];
  }

  private startNewRound() {
    this.level++;
    this.sequence.push(Math.floor(Math.random() * 4));
    this.playerSequence = [];
    this.phase = 'show';
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private readonly handlePointerDown = (e: PointerEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.onInteractionAt(pos.x, pos.y);
  };

  private readonly handleTouch = (e: TouchEvent) => {
    // If pointer events are supported and fired, avoid double trigger
    if (window.PointerEvent && e.type === 'touchstart') return;
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.onInteractionAt(pos.x, pos.y);
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    if (window.PointerEvent && e.type === 'mousedown') return;
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.onInteractionAt(pos.x, pos.y);
  };

  private onInteractionAt(x: number, y: number) {
    if (this.phase === 'lost') {
      this.clearAllTimeouts();
      this.replayCurrentRound();
      return;
    }
    this.handleButtonPress(x, y);
  }

  private handleButtonPress(x: number, y: number) {
    if (this.phase !== 'play') return;

    for (const button of this.buttons) {
      const dist = Math.hypot((x - button.x), (y - button.y));
      if (dist < button.radius) {
        this.activateButton(button.id);
        break;
      }
    }
  }

  private activateButton(buttonId: number) {
    const button = this.buttons[buttonId];
    button.isActive = true;

    this.audio.play(`synth:${button.instrument}`, button.note);
    this.haptics.lightTap();

    const stepIndex = this.playerSequence.length;
    this.playerSequence.push(buttonId);

    this.setGameTimeout(() => {
      button.isActive = false;
    }, 160);

    // Synchronous step validation to prevent async race condition
    if (buttonId !== this.sequence[stepIndex]) {
      this.handleMistake();
      return;
    }

    // Check if player completed the full sequence
    if (this.playerSequence.length === this.sequence.length) {
      this.handleSuccess();
    }
  }

  private handleMistake() {
    this.phase = 'lost';
    this.audio.play('synth:click', 180);
    this.haptics.lightTap();

    // Friendly auto-retry after 1.2s delay
    this.setGameTimeout(() => {
      if (this.phase === 'lost') {
        this.replayCurrentRound();
      }
    }, 1300);
  }

  private handleSuccess() {
    this.phase = 'won';
    this.spawnCelebrationParticles();
    this.haptics.lightTap();

    // After brief celebration pause, advance to next round
    this.setGameTimeout(() => {
      this.startNewRound();
    }, 1000);
  }

  private replayCurrentRound() {
    this.playerSequence = [];
    this.phase = 'show';
  }

  private playSequence() {
    let delay = 200; // Gentle lead-in pause
    for (const buttonId of this.sequence) {
      this.setGameTimeout(() => {
        const button = this.buttons[buttonId];
        button.isActive = true;
        this.audio.play(`synth:${button.instrument}`, button.note);
        this.haptics.lightTap();

        this.setGameTimeout(() => {
          button.isActive = false;
        }, 160);
      }, delay);
      delay += this.highlightDuration + 180;
    }

    this.setGameTimeout(() => {
      this.phase = 'play';
    }, delay);
  }

  private spawnCelebrationParticles() {
    if (!this.canvas) return;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const colors = ['#E05353', '#2E86AB', '#F6BD60', '#588157', '#FFFFFF'];

    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.4;
      const speed = 2.5 + Math.random() * 4.5;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        life: 1.0
      });
    }
  }

  update(dt: number): void {
    if (this.isPaused) return;

    if (this.phase === 'show') {
      this.playSequence();
      this.phase = 'wait'; // Transition to wait, playSequence handles timing
    }

    // Update celebration particles
    if (this.particles.length > 0) {
      const dtSec = Math.min(0.05, (dt || 16.67) / 1000);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 2.0 * dtSec; // soft gravity
        p.life -= dtSec * 1.5;
        p.alpha = Math.max(0, p.life);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    this.ctx.fillStyle = '#F4ECD8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw buttons
    this.buttons.forEach(button => {
      // Button shadow
      this.ctx!.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx!.beginPath();
      this.ctx!.arc(button.x, button.y + 6, button.radius, 0, Math.PI * 2);
      this.ctx!.fill();

      // Button body with gradient
      const grad = this.ctx!.createRadialGradient(
        button.x - button.radius * 0.3,
        button.y - button.radius * 0.3,
        button.radius * 0.2,
        button.x,
        button.y,
        button.radius
      );

      const baseColor = button.color;
      grad.addColorStop(0, this.lightenColor(baseColor, 0.4));
      grad.addColorStop(1, baseColor);

      this.ctx!.fillStyle = grad;
      this.ctx!.beginPath();
      this.ctx!.arc(button.x, button.y, button.radius, 0, Math.PI * 2);
      this.ctx!.fill();

      // Active state (glow and scale)
      if (button.isActive) {
        this.ctx!.strokeStyle = `${baseColor}80`;
        this.ctx!.lineWidth = 6;
        this.ctx!.stroke();
      }

      // Button label (note name)
      this.ctx!.fillStyle = '#FFFFFF';
      this.ctx!.font = 'bold 24px Fredoka, sans-serif';
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'middle';
      this.ctx!.fillText(button.label, button.x, button.y);
    });

    // Draw celebration particles
    if (this.particles.length > 0) {
      this.particles.forEach(p => {
        this.ctx!.save();
        this.ctx!.globalAlpha = p.alpha;
        this.ctx!.fillStyle = p.color;
        this.ctx!.beginPath();
        this.ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx!.fill();
        this.ctx!.restore();
      });
    }

    // HUD: Level and instructions
    this.ctx.fillStyle = '#2B2D5E';
    this.ctx.font = 'bold 28px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`Level ${this.level}`, this.canvas.width / 2, 28);

    // Status text
    this.ctx.font = '18px Fredoka, sans-serif';
    let statusText = '';
    if (this.phase === 'show' || this.phase === 'wait') {
      statusText = 'Listen to the pattern...';
    } else if (this.phase === 'play') {
      statusText = 'Your turn!';
    } else if (this.phase === 'won') {
      statusText = 'Correct! 🎉';
    } else if (this.phase === 'lost') {
      statusText = 'Listen again... 🎵 Tap to retry';
    }
    this.ctx.fillText(statusText, this.canvas.width / 2, this.canvas.height - 55);
  }

  private lightenColor(color: string, factor: number): string {
    const hex = color.replace('#', '');
    const r = Math.min(255, Math.round(Number.parseInt(hex.substring(0, 2), 16) + (255 - Number.parseInt(hex.substring(0, 2), 16)) * factor));
    const g = Math.min(255, Math.round(Number.parseInt(hex.substring(2, 4), 16) + (255 - Number.parseInt(hex.substring(2, 4), 16)) * factor));
    const b = Math.min(255, Math.round(Number.parseInt(hex.substring(4, 6), 16) + (255 - Number.parseInt(hex.substring(4, 6), 16)) * factor));
    return `rgb(${r}, ${g}, ${b})`;
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('touchstart', this.handleTouch);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    }
    this.clearAllTimeouts();
    this.particles = [];
  }
}

