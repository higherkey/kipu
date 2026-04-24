import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';

export class NoButtonGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement | null = null;
  private audio: AudioController;
  private haptics: HapticController;

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    
    // Pre-register sounds
    this.audio.registerSound('no', '/sounds/no.ogg');
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.classList.add('hidden'); // We use DOM for this game

    this.container = document.createElement('div');
    this.container.id = 'no-button-game';
    this.container.innerHTML = `
      <div class="no-button-wrapper">
        <button id="giant-no-button">NO</button>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.container);

    const button = this.container.querySelector('#giant-no-button');
    button?.addEventListener('click', () => this.handlePress());
  }

  private handlePress() {
    this.audio.play('no');
    this.haptics.heavyImpact();
    this.triggerShake();
  }

  private triggerShake() {
    if (this.container) {
      this.container.classList.add('shake');
      setTimeout(() => {
        this.container?.classList.remove('shake');
      }, 500);
    }
  }

  update(_dt: number): void {
    // No frame-by-frame updates needed for this DOM game
  }

  pause(): void {
    if (this.container) this.container.style.pointerEvents = 'none';
  }

  resume(): void {
    if (this.container) this.container.style.pointerEvents = 'all';
  }

  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.canvas) {
      this.canvas.classList.remove('hidden');
    }
  }
}
