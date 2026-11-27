import { BaseGame } from '../../core/BaseGame';
import { CelebrationOverlay } from '../../ui/CelebrationOverlay';

interface Bug {
  x: number;
  y: number;
  radius: number;
  caught: boolean;
  id: number;
}

/**
 * Nuko (Bug Catcher): Search-and-find hidden bug game.
 * Uses Z-index sprite layering and slow scanning mechanics to encourage focus.
 */
export class BugCatcherGame extends BaseGame {
  private bugs: Bug[] = [];
  private bugsCaught = 0;
  private readonly totalBugs = 4;
  private texturePhase = 0; // For animated natural texture background
  private noiseTile: HTMLCanvasElement | null = null;
  private noisePattern: CanvasPattern | null = null;

  constructor() {
    super();
    this.audio.registerSound('catch', '/sounds/pop.ogg'); // Reuse pop for now
  }

  protected onInit(): void {
    this.initNoisePattern();
    this.createBugs();

    this.canvas?.addEventListener('touchstart', this.handleTouch);
    this.canvas?.addEventListener('mousedown', this.handleMouseDown);
  }

  private initNoisePattern() {
    if (typeof document === 'undefined') return;
    const size = 128;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const tileCtx = tile.getContext('2d');
    if (!tileCtx) return;

    try {
      const imgData = tileCtx.createImageData(size, size);
      const data = imgData.data;
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const i = (py * size + px) * 4;
          const noise = Math.sin(px * 0.1) * Math.cos(py * 0.1) * 25 + Math.sin(px * 0.3 + py * 0.2) * 15 + 40;
          const base = 140 + noise;
          data[i] = Math.min(255, Math.max(0, Math.floor(base * 0.7)));     // R
          data[i + 1] = Math.min(255, Math.max(0, Math.floor(base * 0.9))); // G
          data[i + 2] = Math.min(255, Math.max(0, Math.floor(base * 0.8))); // B
          data[i + 3] = 255;
        }
      }
      tileCtx.putImageData(imgData, 0, 0);
      this.noiseTile = tile;

      if (this.ctx && typeof this.ctx.createPattern === 'function') {
        this.noisePattern = this.ctx.createPattern(tile, 'repeat');
      }
    } catch {
      this.noiseTile = tile;
    }
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    const oldW = this.canvas.width || width;
    const oldH = this.canvas.height || height;

    this.canvas.width = width;
    this.canvas.height = height;

    const margin = 120;
    this.bugs.forEach(bug => {
      if (oldW > 0 && oldH > 0) {
        bug.x = (bug.x / oldW) * width;
        bug.y = (bug.y / oldH) * height;
      }
      bug.x = Math.max(margin, Math.min(width - margin, bug.x));
      bug.y = Math.max(margin, Math.min(height - margin, bug.y));
    });

    if (this.ctx && this.noiseTile && typeof this.ctx.createPattern === 'function') {
      try {
        this.noisePattern = this.ctx.createPattern(this.noiseTile, 'repeat');
      } catch {
        // Fallback handled in drawWoolTexture
      }
    }
  }

  private createBugs() {
    if (!this.canvas) return;

    this.bugs = [];
    this.bugsCaught = 0;

    // Generate 4 bugs at random positions
    for (let i = 0; i < this.totalBugs; i++) {
      const margin = 120;
      const x = margin + Math.random() * (this.canvas.width - margin * 2);
      const y = margin + Math.random() * (this.canvas.height - margin * 2);
      
      this.bugs.push({
        x,
        y,
        radius: 25,
        caught: false,
        id: i
      });
    }
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private readonly handleTouch = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.checkBugClick(pos.x, pos.y);
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.checkBugClick(pos.x, pos.y);
  };

  private checkBugClick(x: number, y: number) {
    if (this.bugsCaught === this.totalBugs) {
      this.createBugs();
      this.haptics.lightTap();
      return;
    }

    // Check if click is on any uncaught bug (iterate from last to first for top-down)
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const bug = this.bugs[i];
      if (!bug.caught) {
        const dist = Math.hypot((x - bug.x), (y - bug.y));
        if (dist < bug.radius) {
          bug.caught = true;
          this.bugsCaught++;
          this.audio.play('catch');
          this.haptics.lightTap();
          if (this.bugsCaught === this.totalBugs) {
            CelebrationOverlay.getInstance().celebrate({
              type: 'stars',
              count: 35,
              x: this.canvas ? this.canvas.width / 2 : undefined,
              y: this.canvas ? this.canvas.height / 2 : undefined,
            });
          }
          break; // Only catch one bug per click
        }
      }
    }
  }

  update(dt: number): void {
    this.texturePhase += dt * 0.0001; // Slow animation
    this.render();
  }

  private drawWoolTexture(x: number, y: number, w: number, h: number) {
    if (!this.ctx) return;

    if (this.noisePattern) {
      this.ctx.fillStyle = this.noisePattern;
      this.ctx.fillRect(x, y, w, h);
    } else if (this.noiseTile && typeof this.ctx.drawImage === 'function') {
      const size = this.noiseTile.width;
      for (let tx = x; tx < w; tx += size) {
        for (let ty = y; ty < h; ty += size) {
          this.ctx.drawImage(this.noiseTile, tx, ty);
        }
      }
    } else {
      this.ctx.fillStyle = '#85AB98';
      this.ctx.fillRect(x, y, w, h);
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    // Draw natural textured background (stone/wool)
    this.drawWoolTexture(0, 0, this.canvas.width, this.canvas.height);

    // Draw some variation by adding darker patches
    this.ctx.fillStyle = 'rgba(100, 120, 100, 0.15)';
    for (let i = 0; i < 8; i++) {
      const x = Math.sin(i * 0.7 + this.texturePhase * 0.5) * this.canvas.width * 0.4 + this.canvas.width * 0.5;
      const y = Math.cos(i * 0.9 + this.texturePhase * 0.3) * this.canvas.height * 0.4 + this.canvas.height * 0.5;
      this.ctx.fillRect(x - 50, y - 50, 100, 100);
    }

    // Draw bugs (caught ones are more transparent/visible, uncaught are camouflaged)
    this.bugs.forEach((bug) => {
      if (bug.caught) {
        // Caught bug glows and shrinks slightly
        this.ctx!.fillStyle = '#4ECDC4';
        this.ctx!.globalAlpha = 0.6;
      } else {
        // Uncaught bug is subtle, natural colors (blend with background)
        this.ctx!.fillStyle = '#8B9D6F';
        this.ctx!.globalAlpha = 0.7;
      }

      // Draw bug body (simple oval)
      this.ctx!.beginPath();
      this.ctx!.ellipse(bug.x, bug.y, bug.radius, bug.radius * 0.8, 0, 0, Math.PI * 2);
      this.ctx!.fill();

      // Draw antenna
      this.ctx!.strokeStyle = '#5A6B4F';
      this.ctx!.lineWidth = 2;
      this.ctx!.globalAlpha = 0.8;
      this.ctx!.beginPath();
      this.ctx!.moveTo(bug.x - bug.radius * 0.3, bug.y - bug.radius * 0.5);
      this.ctx!.lineTo(bug.x - bug.radius * 0.5, bug.y - bug.radius * 1.0);
      this.ctx!.stroke();

      this.ctx!.beginPath();
      this.ctx!.moveTo(bug.x + bug.radius * 0.3, bug.y - bug.radius * 0.5);
      this.ctx!.lineTo(bug.x + bug.radius * 0.5, bug.y - bug.radius * 1.0);
      this.ctx!.stroke();

      // Draw simple legs
      this.ctx!.lineWidth = 1.5;
      for (let j = 0; j < 3; j++) {
        const side = j < 1.5 ? -1 : 1;
        this.ctx!.beginPath();
        this.ctx!.moveTo(bug.x + side * bug.radius * 0.3, bug.y + bug.radius * 0.2);
        this.ctx!.lineTo(bug.x + side * bug.radius * 0.6, bug.y + bug.radius * 0.5);
        this.ctx!.stroke();
      }

      this.ctx!.globalAlpha = 1.0;
    });

    // Draw HUD: instruction and bug count
    this.ctx.fillStyle = '#2B2D5E';
    this.ctx.font = '18px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Find the hidden bugs!', this.canvas.width / 2, 40);

    // Bug counter
    this.ctx.font = 'bold 20px Fredoka, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${this.bugsCaught} / ${this.totalBugs}`, this.canvas.width - 30, 40);

    // Win screen
    if (this.bugsCaught === this.totalBugs) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = 'bold 44px Fredoka, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('All bugs found! 🌟', this.canvas.width / 2, this.canvas.height / 2 - 25);

      this.ctx.font = '22px Fredoka, sans-serif';
      this.ctx.fillText('Great focus!', this.canvas.width / 2, this.canvas.height / 2 + 25);

      this.ctx.font = 'bold 16px Fredoka, sans-serif';
      this.ctx.fillStyle = '#FFE66D';
      this.ctx.fillText('Tap anywhere to play again', this.canvas.width / 2, this.canvas.height / 2 + 70);
    }
  }



  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouch);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    }
  }
}
