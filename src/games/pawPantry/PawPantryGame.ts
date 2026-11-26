import type { Game } from '../../core/Game';
import { HapticController } from '../../core/HapticController';
import { StateManager } from '../../core/StateManager';
import { hint, LEVELS, makeBoard, neighbor, playSwap, seededRandom, SIZE, TREATS } from './PantryRules';
import './PawPantryGame.css';

const PROGRESS_KEY = 'pawPantryCompleted';
const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
};

export class PawPantryGame implements Game {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasWasHidden = false;
  private listeners: AbortController | null = null;
  private tiles: HTMLButtonElement[] = [];
  private picker!: HTMLSelectElement;
  private goals!: HTMLElement;
  private movesLabel!: HTMLElement;
  private status!: HTMLElement;
  private hintButton!: HTMLButtonElement;
  private next!: HTMLButtonElement;
  private board: number[] = [];
  private level = 0;
  private completed = 0;
  private moves = 0;
  private remaining: number[] = [];
  private random = seededRandom(0);
  private selected = -1;
  private focusIndex = 0;
  private paused = false;
  private outcome: 'playing' | 'won' | 'lost' = 'playing';
  private turn?: NonNullable<ReturnType<typeof playSwap>>;
  private wave = 0;
  private elapsed = 0;
  private suggested?: [number, number];
  private pointer?: { id: number; index: number; x: number; y: number };
  private swiped = false;
  private reducedMotion = false;

  init(canvas: HTMLCanvasElement): void {
    this.destroy();
    this.canvas = canvas;
    this.canvasWasHidden = canvas.classList.contains('hidden');
    canvas.classList.add('hidden');
    this.paused = false;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };

    const root = document.createElement('section');
    root.className = 'paw-pantry';
    root.setAttribute('aria-labelledby', 'pantry-title');
    root.innerHTML = `
      <div class="pantry-layout">
        <header class="pantry-intro">
          <div class="pantry-scene" aria-hidden="true">
            <div class="pantry-window"></div>
            <div class="pantry-cat"><i></i><b></b></div>
            <div class="pantry-bowl"></div>
          </div>
          <h1 id="pantry-title">Paw Pantry</h1>
          <p id="pantry-rules">Swipe or tap two neighbors to match 3 in a line. Match 4 to clear a line, or 5 to clear a row and column.</p>
          <label for="pantry-level">Level</label>
          <select id="pantry-level">${LEVELS.map(({ name }, i) => `<option>${i + 1}. ${name}</option>`).join('')}</select>
        </header>
        <div class="pantry-play">
          <div class="pantry-hud">
            <div><span>Collect</span><ul class="pantry-goals"></ul></div>
            <div class="pantry-moves"><span>Moves</span><strong></strong></div>
          </div>
          <span id="pantry-keys" hidden>Use arrow keys to move between tiles. Press Enter or Space to select a tile.</span>
          <div class="pantry-board" role="grid" aria-label="Treat board" aria-describedby="pantry-rules pantry-keys"></div>
          <p class="pantry-status" role="status"></p>
          <div class="pantry-actions">
            <button type="button" class="pantry-hint">Hint</button>
            <button type="button" class="pantry-reset">Restart</button>
            <button type="button" class="pantry-next" hidden>Next level</button>
          </div>
        </div>
      </div>`;
    this.root = root;
    this.picker = root.querySelector('#pantry-level')!;
    this.goals = root.querySelector('.pantry-goals')!;
    this.movesLabel = root.querySelector('.pantry-moves strong')!;
    this.status = root.querySelector('.pantry-status')!;
    this.hintButton = root.querySelector('.pantry-hint')!;
    this.next = root.querySelector('.pantry-next')!;

    const board = root.querySelector<HTMLElement>('.pantry-board')!;
    this.tiles = Array.from({ length: SIZE * SIZE }, (_, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'pantry-tile';
      tile.dataset.index = String(index);
      tile.innerHTML = '<span class="pantry-piece" aria-hidden="true"></span>';
      return tile;
    });
    for (let rowIndex = 0; rowIndex < SIZE; rowIndex++) {
      const row = document.createElement('div');
      row.className = 'pantry-row';
      row.setAttribute('role', 'row');
      for (const tile of this.tiles.slice(rowIndex * SIZE, (rowIndex + 1) * SIZE)) {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'gridcell');
        cell.append(tile);
        row.append(cell);
      }
      board.append(row);
    }
    board.addEventListener('click', this.clickTile, options);
    board.addEventListener('keydown', this.navigate, options);
    board.addEventListener('focusin', this.rememberFocus, options);
    board.addEventListener('pointerdown', this.startSwipe, options);
    window.addEventListener('pointerup', this.endSwipe, options);
    window.addEventListener('pointercancel', this.cancelSwipe, options);
    this.picker.addEventListener('change', () => {
      if (this.available() && this.picker.selectedIndex <= this.completed) this.load(this.picker.selectedIndex);
      else this.picker.selectedIndex = this.level;
    }, options);
    this.hintButton.addEventListener('click', () => {
      if (!this.canMove()) return;
      this.selected = -1;
      this.suggested = hint(this.board);
      if (!this.suggested) return;
      const [a, b] = this.suggested;
      this.status.textContent = `Try swapping ${this.tileLabel(a)} with ${this.tileLabel(b)}.`;
      this.renderTiles();
    }, options);
    root.querySelector('.pantry-reset')!.addEventListener('click', () => {
      if (this.available()) {
        this.load(this.level);
        this.tiles[0].focus();
      }
    }, options);
    this.next.addEventListener('click', () => {
      if (this.available() && this.outcome === 'won' && this.level < LEVELS.length - 1) {
        this.load(this.level + 1);
        this.tiles[0].focus();
      }
    }, options);

    this.completed = 0;
    try {
      const saved = StateManager.getInstance().get(PROGRESS_KEY, 0);
      if (Number.isInteger(saved)) this.completed = Math.max(0, Math.min(saved, LEVELS.length));
    } catch {
      // Play remains available when browser storage is blocked.
    }
    canvas.insertAdjacentElement('afterend', root);
    this.load(Math.min(this.completed, LEVELS.length - 1));
  }

  private available(): boolean {
    return this.root !== null && !this.paused &&
      !document.body.matches('.menu-open, .parental-gate-open');
  }

  private canMove(): boolean {
    return this.available() && this.outcome === 'playing' && !this.turn;
  }

  private load(index: number): void {
    this.level = index;
    const level = LEVELS[index];
    this.random = seededRandom(level.seed);
    this.board = makeBoard(this.random);
    this.remaining = level.goals.map(([, count]) => count);
    this.moves = level.moves;
    this.selected = -1;
    this.focusIndex = 0;
    this.outcome = 'playing';
    this.turn = undefined;
    this.suggested = undefined;
    this.pointer = undefined;
    this.swiped = false;
    this.status.textContent = '';
    this.picker.selectedIndex = index;
    this.render();
  }

  private tileLabel(index: number, board = this.board): string {
    return `${TREATS[board[index]]}, row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}`;
  }

  private tileIndex(event: Event): number {
    const tile = (event.target as Element).closest<HTMLButtonElement>('.pantry-tile');
    return tile ? Number(tile.dataset.index) : -1;
  }

  private rememberFocus = (event: FocusEvent): void => {
    const index = this.tileIndex(event);
    if (index < 0) return;
    this.tiles[this.focusIndex].tabIndex = -1;
    this.focusIndex = index;
    this.tiles[index].tabIndex = 0;
  };

  private navigate = (event: KeyboardEvent): void => {
    const direction = DIRECTIONS[event.key];
    if (!direction || !this.available()) return;
    event.preventDefault();
    const next = neighbor(this.focusIndex, ...direction);
    if (next >= 0) this.tiles[next].focus();
  };

  private clickTile = (event: MouseEvent): void => {
    if ((this.swiped && event.detail > 0) || !this.canMove()) return;
    const index = this.tileIndex(event);
    if (index < 0) return;
    this.tiles[index].focus();
    const previous = this.selected;
    const adjacent = Object.values(DIRECTIONS).some(direction => neighbor(index, ...direction) === previous);
    this.selected = previous === index ? -1 : index;
    this.suggested = undefined;
    if (previous >= 0 && adjacent) this.move(previous, index);
    else {
      this.status.textContent = '';
      this.renderTiles();
    }
  };

  private startSwipe = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || !this.canMove()) return;
    const index = this.tileIndex(event);
    this.swiped = false;
    if (index >= 0) this.pointer = { id: event.pointerId, index, x: event.clientX, y: event.clientY };
  };

  private endSwipe = (event: PointerEvent): void => {
    const start = this.pointer;
    if (!start || start.id !== event.pointerId) return;
    this.pointer = undefined;
    if (!this.canMove()) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    this.swiped = true;
    const next = Math.abs(dx) > Math.abs(dy)
      ? neighbor(start.index, 0, Math.sign(dx))
      : neighbor(start.index, Math.sign(dy), 0);
    if (next >= 0) {
      this.tiles[next].focus({ preventScroll: true });
      this.move(start.index, next);
    }
  };

  private cancelSwipe = (event: PointerEvent): void => {
    if (event.pointerId === this.pointer?.id) this.pointer = undefined;
  };

  private move(a: number, b: number): void {
    this.selected = -1;
    this.suggested = undefined;
    const turn = playSwap(this.board, a, b, this.random);
    if (!turn) {
      this.status.textContent = 'That swap makes no match. Try another pair.';
      this.renderTiles();
      return;
    }
    this.moves--;
    this.turn = turn;
    this.wave = 0;
    this.elapsed = 0;
    this.status.textContent = '';
    HapticController.getInstance().lightTap();
    if (this.reducedMotion) this.finishTurn();
    else this.render();
  }

  update(dt: number): void {
    if (!this.available() || !this.turn) return;
    this.elapsed += dt;
    if (this.elapsed < 175) return;
    this.elapsed -= 175;
    this.wave++;
    if (this.wave === this.turn.waves.length) this.finishTurn();
    else this.renderTiles();
  }

  private finishTurn(): void {
    const turn = this.turn!;
    this.turn = undefined;
    this.board = turn.board;
    this.remaining = LEVELS[this.level].goals.map(([treat], i) =>
      Math.max(0, this.remaining[i] - turn.collected[treat]));
    if (this.remaining.every(count => count === 0)) {
      this.outcome = 'won';
      if (this.completed <= this.level) {
        this.completed = this.level + 1;
        try {
          StateManager.getInstance().set(PROGRESS_KEY, this.completed);
        } catch {
          // The current session still keeps its unlocked levels when storage is full.
        }
      }
      this.status.textContent = this.level === LEVELS.length - 1 ? 'Every pantry is stocked!' : 'Pantry stocked! Next level unlocked.';
      HapticController.getInstance().success();
    } else if (!this.moves) {
      this.outcome = 'lost';
      this.status.textContent = 'Out of moves. Restart for another try.';
    } else if (turn.shuffled) {
      this.status.textContent = 'The board was reshuffled. New matches are ready!';
    } else {
      const count = turn.collected.reduce((total, amount) => total + amount, 0);
      this.status.textContent = `${count} treats collected${turn.waves.length > 1 ? ` in a ${turn.waves.length}-match chain` : ''}. ${this.moves} moves left.`;
    }
    this.render();
  }

  private render(): void {
    this.movesLabel.textContent = String(this.moves);
    this.goals.innerHTML = LEVELS[this.level].goals.map(([treat], i) =>
      `<li data-treat="${treat}" aria-label="${this.remaining[i]} ${TREATS[treat]} remaining">
        <span class="pantry-piece" aria-hidden="true"></span><strong>${this.remaining[i] || '✓'}</strong>
      </li>`).join('');
    Array.from(this.picker.options).forEach((option, index) => { option.disabled = index > this.completed; });
    this.hintButton.disabled = Boolean(this.turn) || this.outcome !== 'playing';
    this.next.hidden = this.outcome !== 'won' || this.level === LEVELS.length - 1;
    this.renderTiles();
  }

  private renderTiles(): void {
    const wave = this.turn?.waves[this.wave];
    const board = wave?.board ?? this.board;
    this.tiles.forEach((tile, index) => {
      tile.dataset.treat = String(board[index]);
      tile.tabIndex = index === this.focusIndex ? 0 : -1;
      tile.setAttribute('aria-label', this.tileLabel(index, board));
      tile.setAttribute('aria-pressed', String(index === this.selected));
      tile.setAttribute('aria-disabled', String(Boolean(this.turn) || this.outcome !== 'playing'));
      tile.classList.toggle('pantry-suggested', Boolean(this.suggested?.includes(index)));
      tile.classList.remove('pantry-clearing');
    });
    if (wave) {
      // Restart the clear animation when successive waves share a cell.
      void this.tiles[0].offsetWidth;
      wave.cleared.forEach(index => this.tiles[index].classList.add('pantry-clearing'));
    }
  }

  pause(): void {
    this.paused = true;
    this.pointer = undefined;
  }

  resume(): void {
    this.paused = false;
  }

  destroy(): void {
    this.listeners?.abort();
    this.listeners = null;
    this.root?.remove();
    this.root = null;
    if (!this.canvasWasHidden) this.canvas?.classList.remove('hidden');
    this.canvas = null;
    this.tiles = [];
    this.turn = undefined;
    this.pointer = undefined;
  }
}
