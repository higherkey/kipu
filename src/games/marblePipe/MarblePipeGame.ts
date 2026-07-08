import type { Game } from '../../core/Game';
import { AudioController } from '../../core/AudioController';
import { HapticController } from '../../core/HapticController';

interface PipePiece {
  gridX: number;
  gridY: number;
  rotation: number; // 0, 90, 180, 270
  connected: boolean;
  type: 'straight' | 'corner' | 'tee'; // Simplified for MVP
}

interface Marble {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  velocity: number;
  currentDirection: number; // 0=right, 90=down, 180=left, 270=up (degrees)
}

/**
 * Marble Pipe Run: Logic puzzle connecting pipes for a marble.
 * Players tap pipes to rotate them and create a path from start to end.
 */
export class MarblePipeGame implements Game {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private audio: AudioController;
  private haptics: HapticController;

  private grid: (PipePiece | null)[][] = [];
  private gridSize = 4;
  private cellSize = 0;
  private marble: Marble = { x: 0, y: 0, gridX: 0, gridY: 0, velocity: 0, currentDirection: 0 };
  private gameWon = false;
  private marbleAnimating = false;

  constructor() {
    this.audio = AudioController.getInstance();
    this.haptics = HapticController.getInstance();
    this.audio.registerSound('snap', '/sounds/pop.ogg');
    this.audio.registerSound('win', '/sounds/pop.ogg');
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.cellSize = Math.min(canvas.width, canvas.height) / (this.gridSize + 2);
    this.initializeGrid();

    canvas.addEventListener('touchstart', this.handleTouch);
    canvas.addEventListener('mousedown', this.handleMouseDown);
  }

  private initializeGrid() {
    this.grid = [];

    // Simple 4x4 grid with some pre-placed pipes and empty cells
    for (let y = 0; y < this.gridSize; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridSize; x++) {
        if ((x === 0 && y === 0) || (x === 3 && y === 3)) {
          // Start and end pieces are fixed straight pipes
          this.grid[y][x] = {
            gridX: x,
            gridY: y,
            rotation: x === 0 ? 0 : 180,
            connected: false,
            type: 'straight'
          };
        } else if (Math.random() < 0.4) {
          // Randomly place some pipes
          const types: Array<'straight' | 'corner' | 'tee'> = ['straight', 'corner', 'tee'];
          const type = types[Math.floor(Math.random() * types.length)];
          this.grid[y][x] = {
            gridX: x,
            gridY: y,
            rotation: Math.floor(Math.random() * 4) * 90,
            connected: false,
            type
          };
        } else {
          this.grid[y][x] = null;
        }
      }
    }

    // Initialize marble at start
    this.marble = {
      x: this.cellSize * 1.5,
      y: this.cellSize * 1.5,
      gridX: 0,
      gridY: 0,
      velocity: 0,
      currentDirection: 0
    };
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private handleTouch = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const pos = this.getCanvasPos(touch.clientX, touch.clientY);
    this.handleGridClick(pos.x, pos.y);
  };

  private handleMouseDown = (e: MouseEvent) => {
    const pos = this.getCanvasPos(e.clientX, e.clientY);
    this.handleGridClick(pos.x, pos.y);
  };

  private handleGridClick(x: number, y: number) {
    const gridX = Math.floor((x - this.cellSize * 0.5) / this.cellSize);
    const gridY = Math.floor((y - this.cellSize * 0.5) / this.cellSize);

    if (gridX >= 0 && gridX < this.gridSize && gridY >= 0 && gridY < this.gridSize) {
      const piece = this.grid[gridY][gridX];
      if (piece) {
        piece.rotation = (piece.rotation + 90) % 360;
        this.audio.play('snap');
        this.haptics.lightTap();
      }
    }
  }

  private checkPipeConnectivity() {
    // Simple check: trace from start to end
    let connected = true;
    let x = 0;
    let y = 0;
    let direction = 0; // 0=right, 1=down, 2=left, 3=up

    for (let step = 0; step < 20; step++) {
      if (x === 3 && y === 3) {
        this.gameWon = true;
        return;
      }

      const piece = this.grid[y][x];
      if (!piece) {
        connected = false;
        break;
      }

      // Move to next cell based on direction
      const nextX = x + (direction === 0 ? 1 : direction === 2 ? -1 : 0);
      const nextY = y + (direction === 1 ? 1 : direction === 3 ? -1 : 0);

      if (nextX < 0 || nextX >= this.gridSize || nextY < 0 || nextY >= this.gridSize) {
        break;
      }

      x = nextX;
      y = nextY;
    }
  }

  update(_dt: number): void {
    this.checkPipeConnectivity();
    this.render();
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    // Background
    this.ctx.fillStyle = '#F4ECD8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid cells
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cellX = this.cellSize * (x + 0.5);
        const cellY = this.cellSize * (y + 0.5);

        // Cell background
        const piece = this.grid[y][x];
        if (piece) {
          this.ctx.fillStyle = '#E8DCC8';
          this.ctx.fillRect(cellX - this.cellSize * 0.4, cellY - this.cellSize * 0.4, this.cellSize * 0.8, this.cellSize * 0.8);

          // Draw pipe with rotation
          this.drawPipe(cellX, cellY, piece, this.cellSize * 0.35);
        }
      }
    }

    // Draw marble
    const marbleScreenX = this.cellSize * (this.marble.gridX + 0.5);
    const marbleScreenY = this.cellSize * (this.marble.gridY + 0.5);

    this.ctx.fillStyle = '#A0522D';
    this.ctx.beginPath();
    this.ctx.arc(marbleScreenX, marbleScreenY, this.cellSize * 0.12, 0, Math.PI * 2);
    this.ctx.fill();

    // Marble shine
    this.ctx.fillStyle = '#D4A574';
    this.ctx.beginPath();
    this.ctx.arc(marbleScreenX - this.cellSize * 0.04, marbleScreenY - this.cellSize * 0.04, this.cellSize * 0.05, 0, Math.PI * 2);
    this.ctx.fill();

    // HUD
    this.ctx.fillStyle = '#2B2D5E';
    this.ctx.font = 'bold 24px Fredoka, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Connect the pipes!', this.canvas.width / 2, 20);

    if (this.gameWon) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = 'bold 48px Fredoka, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Marble made it!', this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  private drawPipe(x: number, y: number, piece: PipePiece, size: number) {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((piece.rotation * Math.PI) / 180);

    this.ctx.strokeStyle = '#8B7355';
    this.ctx.lineWidth = size * 0.5;
    this.ctx.lineCap = 'round';

    if (piece.type === 'straight') {
      // Horizontal line
      this.ctx.beginPath();
      this.ctx.moveTo(-size, 0);
      this.ctx.lineTo(size, 0);
      this.ctx.stroke();
    } else if (piece.type === 'corner') {
      // L-shaped corner
      this.ctx.beginPath();
      this.ctx.moveTo(-size, 0);
      this.ctx.lineTo(0, 0);
      this.ctx.lineTo(0, size);
      this.ctx.stroke();
    } else if (piece.type === 'tee') {
      // T-shaped
      this.ctx.beginPath();
      this.ctx.moveTo(-size, 0);
      this.ctx.lineTo(size, 0);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(0, size);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  pause(): void {}
  resume(): void {}

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouch);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    }
  }
}
