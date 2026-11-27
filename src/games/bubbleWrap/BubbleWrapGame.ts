import { BaseGame } from '../../core/BaseGame';
import { CelebrationOverlay } from '../../ui/CelebrationOverlay';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  popped: boolean;
}

export class BubbleWrapGame extends BaseGame {
  private bubbles: Bubble[] = [];
  private isMouseDown: boolean = false;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.audio.registerSound('pop', '/sounds/pop.ogg');
  }

  protected onInit(): void {
    this.isMouseDown = false;
    this.createGrid();

    this.canvas?.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.canvas?.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas?.addEventListener('mousedown', this.handleMouseDown);
    this.canvas?.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  public resize(width?: number, height?: number): void {
    if (!this.canvas) return;
    if (width !== undefined && height !== undefined) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.createGrid();
  }

  private createGrid() {
    if (!this.canvas) return;
    const padding = 60;
    const spacing = 100;
    const cols = Math.floor((this.canvas.width - padding) / spacing);
    const rows = Math.floor((this.canvas.height - padding) / spacing);

    this.bubbles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bubbles.push({
          x: padding + c * spacing + spacing / 2,
          y: padding + r * spacing + spacing / 2,
          radius: 40,
          popped: false
        });
      }
    }
  }

  private readonly handleTouch = (e: TouchEvent) => {
    if (!this.canvas) return;
    if (e.cancelable) e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    Array.from(e.changedTouches).forEach(touch => {
      this.checkPop(touch.clientX - rect.left, touch.clientY - rect.top);
    });
  };

  private readonly handleTouchMove = (e: TouchEvent) => {
    if (!this.canvas) return;
    if (e.cancelable) e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    Array.from(e.changedTouches).forEach(touch => {
      this.checkPop(touch.clientX - rect.left, touch.clientY - rect.top);
    });
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    if (!this.canvas) return;
    this.isMouseDown = true;
    const rect = this.canvas.getBoundingClientRect();
    this.checkPop(e.clientX - rect.left, e.clientY - rect.top);
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    if (!this.canvas || !this.isMouseDown) return;
    const rect = this.canvas.getBoundingClientRect();
    this.checkPop(e.clientX - rect.left, e.clientY - rect.top);
  };

  private readonly handleMouseUp = () => {
    this.isMouseDown = false;
  };

  private checkPop(x: number, y: number) {
    let poppedAny = false;
    this.bubbles.forEach(bubble => {
      if (!bubble.popped) {
        const dist = Math.hypot((x - bubble.x), (y - bubble.y));
        if (dist < bubble.radius) {
          bubble.popped = true;
          poppedAny = true;
          this.audio.play('pop');
          this.haptics.lightTap();
        }
      }
    });

    if (poppedAny && this.bubbles.length > 0 && this.bubbles.every(b => b.popped)) {
      this.onAllPopped();
    }
  }

  private onAllPopped() {
    this.haptics.success();
    CelebrationOverlay.getInstance().celebrate({
      type: 'confetti',
      count: 35,
    });

    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
    }

    this.resetTimeout = setTimeout(() => {
      this.createGrid();
      this.resetTimeout = null;
    }, 1200);
  }

  update(_dt: number): void {
    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.bubbles.forEach(bubble => {
      this.ctx!.beginPath();
      this.ctx!.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      
      if (bubble.popped) {
        this.ctx!.strokeStyle = 'rgba(47, 48, 97, 0.2)';
        this.ctx!.lineWidth = 2;
        this.ctx!.stroke();
      } else {
        // Bubble gradient
        const grad = this.ctx!.createRadialGradient(
          bubble.x - bubble.radius/3, bubble.y - bubble.radius/3, bubble.radius/10,
          bubble.x, bubble.y, bubble.radius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#4ECDC4');
        
        this.ctx!.fillStyle = grad;
        this.ctx!.fill();
        this.ctx!.strokeStyle = 'rgba(47, 48, 97, 0.5)';
        this.ctx!.lineWidth = 3;
        this.ctx!.stroke();
      }
    });
  }

  destroy(): void {
    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouch);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    }
    window.removeEventListener('mouseup', this.handleMouseUp);
  }
}
