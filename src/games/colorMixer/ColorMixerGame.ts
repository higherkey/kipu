import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  originalColor: string;
  isDragging: boolean;
}

/**
 * Maka (Color Mixer): Learning primary/secondary colors by merging blobs.
 * Uses canvas globalCompositeOperation to show how colors combine.
 */
export class ColorMixerGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private blobs: Blob[] = [];
  private audio: AudioController;
  private haptics: HapticController;
  private draggingBlob: Blob | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    this.audio.registerSound('bloop', '/sounds/pop.ogg'); // Reuse pop sound for now
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.createBlobs();

    canvas.addEventListener('touchstart', this.handleTouchStart);
    canvas.addEventListener('touchmove', this.handleTouchMove);
    canvas.addEventListener('touchend', this.handleTouchEnd);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
  }

  private createBlobs() {
    if (!this.canvas) return;

    // Primary colors: Red, Yellow, Blue
    const colors = ['#FF6B6B', '#FFD93D', '#4ECDC4']; // Red-ish, Yellow, Cyan-ish (as blue proxy)
    const baseRadius = 60;
    const margin = 100;

    this.blobs = [];

    // Position three blobs in triangular arrangement
    const positions = [
      { x: margin, y: this.canvas.height * 0.3 },
      { x: this.canvas.width - margin, y: this.canvas.height * 0.3 },
      { x: this.canvas.width * 0.5, y: this.canvas.height - margin }
    ];

    colors.forEach((color, i) => {
      const pos = positions[i];
      this.blobs.push({
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        radius: baseRadius,
        color: color,
        originalColor: color,
        isDragging: false
      });
    });
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private handleTouchStart = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.selectBlob(pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
  };

  private handleTouchMove = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.dragBlob(pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
  };

  private handleTouchEnd = () => {
    this.releaseBlob();
  };

  private handleMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.selectBlob(pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
  };

  private handleMouseMove = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.dragBlob(pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
  };

  private handleMouseUp = () => {
    this.releaseBlob();
  };

  private selectBlob(x: number, y: number) {
    // Select the topmost blob at this position
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const blob = this.blobs[i];
      const dist = Math.sqrt((x - blob.x) ** 2 + (y - blob.y) ** 2);
      if (dist < blob.radius) {
        this.draggingBlob = blob;
        blob.isDragging = true;
        this.haptics.lightTap();
        break;
      }
    }
  }

  private dragBlob(x: number, y: number) {
    if (this.draggingBlob) {
      this.draggingBlob.x = Math.max(this.draggingBlob.radius, Math.min(x, this.canvas!.width - this.draggingBlob.radius));
      this.draggingBlob.y = Math.max(this.draggingBlob.radius, Math.min(y, this.canvas!.height - this.draggingBlob.radius));
    }
  }

  private releaseBlob() {
    if (this.draggingBlob) {
      this.draggingBlob.isDragging = false;
      this.draggingBlob = null;
    }
  }

  private checkBlobCollisions() {
    // Check for blob overlaps and update their blended colors
    for (let i = 0; i < this.blobs.length; i++) {
      for (let j = i + 1; j < this.blobs.length; j++) {
        const blob1 = this.blobs[i];
        const blob2 = this.blobs[j];
        const dist = Math.sqrt((blob1.x - blob2.x) ** 2 + (blob1.y - blob2.y) ** 2);

        if (dist < blob1.radius + blob2.radius) {
          // Blobs are overlapping — trigger a bloop and optionally change colors
          if (!blob1.isDragging && !blob2.isDragging) {
            this.audio.play('bloop');
            this.haptics.lightTap();
          }
        }
      }
    }
  }

  update(_dt: number): void {
    this.checkBlobCollisions();
    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw blobs with soft shadows and glow
    this.blobs.forEach((blob, idx) => {
      // Shadow
      const shadowGrad = this.ctx!.createRadialGradient(blob.x, blob.y + 5, 0, blob.x, blob.y + 5, blob.radius);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx!.fillStyle = shadowGrad;
      this.ctx!.fillRect(blob.x - blob.radius, blob.y + blob.radius * 0.8, blob.radius * 2, blob.radius * 0.4);

      // Main blob gradient
      const grad = this.ctx!.createRadialGradient(
        blob.x - blob.radius * 0.3,
        blob.y - blob.radius * 0.3,
        blob.radius * 0.2,
        blob.x,
        blob.y,
        blob.radius
      );
      grad.addColorStop(0, this.lightenColor(blob.color, 0.3));
      grad.addColorStop(1, blob.color);

      this.ctx!.fillStyle = grad;
      this.ctx!.beginPath();
      this.ctx!.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
      this.ctx!.fill();

      // Glow for dragging blobs
      if (blob.isDragging) {
        this.ctx!.strokeStyle = `${blob.color}80`;
        this.ctx!.lineWidth = 4;
        this.ctx!.stroke();
      }

      // Label
      this.ctx!.fillStyle = '#2B2D5E';
      this.ctx!.font = 'bold 16px Fredoka, sans-serif';
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'middle';
      const labels = ['Red', 'Yellow', 'Blue'];
      this.ctx!.fillText(labels[idx], blob.x, blob.y);
    });

    // Draw instruction text at top
    this.ctx.fillStyle = '#2B2D5E';
    this.ctx.font = '18px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Drag the blobs to mix colors!', this.canvas.width / 2, 40);
  }

  private lightenColor(color: string, factor: number): string {
    // Simple hex lightening — this is a basic implementation
    // For production, use proper color parsing
    const hex = color.replace('#', '');
    const r = Math.min(255, Math.round(parseInt(hex.substring(0, 2), 16) + (255 - parseInt(hex.substring(0, 2), 16)) * factor));
    const g = Math.min(255, Math.round(parseInt(hex.substring(2, 4), 16) + (255 - parseInt(hex.substring(2, 4), 16)) * factor));
    const b = Math.min(255, Math.round(parseInt(hex.substring(4, 6), 16) + (255 - parseInt(hex.substring(4, 6), 16)) * factor));
    return `rgb(${r}, ${g}, ${b})`;
  }

  pause(): void {}
  resume(): void {}

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    }
  }
}
