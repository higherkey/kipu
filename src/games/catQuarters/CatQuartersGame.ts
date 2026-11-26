import type { Game } from '../../core/Game';
import { Icons } from '../../ui/Icons';
import { findConflicts, PUZZLES } from './Puzzles';
import './CatQuartersGame.css';

type Cell = 'empty' | 'cat' | 'mark';

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export class CatQuartersGame implements Game {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasWasHidden = false;
  private listeners: AbortController | null = null;
  private board!: HTMLElement;
  private picker!: HTMLSelectElement;
  private status!: HTMLElement;
  private undo!: HTMLButtonElement;
  private reset!: HTMLButtonElement;
  private next!: HTMLButtonElement;
  private tiles: HTMLButtonElement[] = [];
  private cells: Cell[] = [];
  private history: { index: number; previous: Cell }[] = [];
  private tool: 'cat' | 'mark' = 'cat';
  private puzzleIndex = 0;
  private size = 0;
  private regions = '';
  private paused = false;

  init(canvas: HTMLCanvasElement): void {
    this.destroy();
    this.canvas = canvas;
    this.canvasWasHidden = canvas.classList.contains('hidden');
    canvas.classList.add('hidden');
    this.paused = false;
    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };
    const root = document.createElement('section');
    root.className = 'cat-quarters';
    root.setAttribute('aria-labelledby', 'cq-title');
    root.innerHTML = `
      <div class="cq-layout">
        <header class="cq-intro">
          <h1 id="cq-title">Cat Quarters</h1>
          <p id="cq-rules">Give every row, column, and lettered room exactly one cat. Keep cats apart, even at the corners.</p>
          <label for="cq-puzzle">Puzzle</label>
          <select id="cq-puzzle">${PUZZLES.map(({ name, rows }, index) =>
            `<option value="${index}">${name} · ${rows.length} × ${rows.length}</option>`).join('')}</select>
        </header>
        <div class="cq-play">
          <div class="cq-tools" role="group" aria-label="Tile tools">
            <button type="button" data-tool="cat" aria-pressed="true">${Icons.cat} Cat</button>
            <button type="button" data-tool="mark" aria-pressed="false"><span aria-hidden="true">×</span> Mark</button>
          </div>
          <p id="cq-controls">Choose a tool, then tap a tile. Tap again to erase it. Marks help you rule out tiles.</p>
          <div class="cq-board" role="group" aria-label="Puzzle board" aria-describedby="cq-rules cq-controls"></div>
          <p class="cq-status" role="status"></p>
          <div class="cq-actions">
            <button type="button" class="cq-undo">Undo</button>
            <button type="button" class="cq-reset">Reset</button>
            <button type="button" class="cq-next" hidden>Next puzzle</button>
          </div>
        </div>
      </div>`;
    this.root = root;
    this.board = root.querySelector('.cq-board')!;
    this.picker = root.querySelector('#cq-puzzle')!;
    this.status = root.querySelector('.cq-status')!;
    this.undo = root.querySelector('.cq-undo')!;
    this.reset = root.querySelector('.cq-reset')!;
    this.next = root.querySelector('.cq-next')!;

    const tools = root.querySelectorAll<HTMLButtonElement>('[data-tool]');
    tools.forEach(button => button.addEventListener('click', () => {
      if (!this.canPlay()) return;
      this.tool = button.dataset.tool === 'cat' ? 'cat' : 'mark';
      tools.forEach(tool => tool.setAttribute('aria-pressed', String(tool === button)));
    }, options));
    this.tool = 'cat';
    this.board.addEventListener('click', this.playCell, options);
    this.board.addEventListener('keydown', this.moveFocus, options);
    this.picker.addEventListener('change', () => {
      if (this.canPlay()) this.loadPuzzle(this.picker.selectedIndex);
      else this.picker.selectedIndex = this.puzzleIndex;
    }, options);
    this.undo.addEventListener('click', () => {
      if (!this.canPlay()) return;
      const move = this.history.pop();
      if (!move) return;
      this.cells[move.index] = move.previous;
      this.render();
      if (this.undo.disabled) this.focusTile(move.index);
    }, options);
    this.reset.addEventListener('click', () => {
      if (!this.canPlay()) return;
      this.loadPuzzle();
      this.focusTile(0);
    }, options);
    this.next.addEventListener('click', () => {
      if (!this.canPlay()) return;
      this.loadPuzzle((this.puzzleIndex + 1) % PUZZLES.length);
      this.focusTile(0);
    }, options);
    canvas.insertAdjacentElement('afterend', root);
    this.loadPuzzle(0);
  }

  private canPlay(): boolean {
    return !this.paused && !document.body.classList.contains('menu-open');
  }

  private loadPuzzle(index = this.puzzleIndex): void {
    this.puzzleIndex = index;
    this.picker.selectedIndex = index;
    const { rows } = PUZZLES[index];
    this.size = rows.length;
    this.regions = rows.join('');
    this.history = [];
    this.cells = Array.from(this.regions, () => 'empty');
    this.board.dataset.size = String(this.size);
    this.tiles = Array.from(this.regions, (room, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'cq-tile';
      tile.dataset.index = String(index);
      tile.dataset.room = room;
      tile.tabIndex = index === 0 ? 0 : -1;
      tile.classList.toggle('cq-divider-end',
        (index + 1) % this.size !== 0 && room !== this.regions[index + 1]);
      tile.classList.toggle('cq-divider-bottom',
        index + this.size < this.regions.length && room !== this.regions[index + this.size]);
      tile.innerHTML = `<span class="cq-room" aria-hidden="true">${room}</span>
        ${Icons.cat}<span class="cq-mark" aria-hidden="true">×</span>
        <span class="cq-conflict" aria-hidden="true">!</span>`;
      return tile;
    });
    this.board.replaceChildren(...this.tiles);
    this.render();
  }

  private tileIndex(target: EventTarget | null): number | undefined {
    const tile = target instanceof Element ? target.closest<HTMLButtonElement>('.cq-tile') : null;
    return tile && this.board.contains(tile) ? Number(tile.dataset.index) : undefined;
  }

  private playCell = (event: MouseEvent): void => {
    const index = this.tileIndex(event.target);
    if (index === undefined || !this.canPlay() || !this.next.hidden) return;
    const previous = this.cells[index];
    this.history.push({ index, previous });
    this.cells[index] = previous === this.tool ? 'empty' : this.tool;
    this.render();
    this.focusTile(index);
  };

  private moveFocus = (event: KeyboardEvent): void => {
    const index = this.tileIndex(event.target);
    const move = ARROWS[event.key];
    if (index === undefined || !move || !this.canPlay()) return;
    event.preventDefault();
    const row = Math.floor(index / this.size) + move[0];
    const col = index % this.size + move[1];
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return;
    this.focusTile(row * this.size + col);
  };

  private focusTile(index: number): void {
    this.tiles.forEach((tile, position) => { tile.tabIndex = position === index ? 0 : -1; });
    this.tiles[index].focus();
  }

  private render(): void {
    const cats = this.cells.flatMap((cell, index) => cell === 'cat' ? [index] : []);
    const conflicts = findConflicts(this.regions, this.size, cats);
    const solved = cats.length === this.size && conflicts.size === 0;
    this.tiles.forEach((tile, index) => {
      const state = this.cells[index];
      const conflict = conflicts.has(index);
      tile.dataset.state = state;
      tile.classList.toggle('cq-has-conflict', conflict);
      tile.setAttribute('aria-label', `Row ${Math.floor(index / this.size) + 1}, column ${index % this.size + 1}, room ${this.regions[index]}, ${state}${conflict ? ', conflict' : ''}`);
      tile.setAttribute('aria-disabled', String(solved));
    });
    const status = conflicts.size
      ? 'Check the cats marked with !'
      : `${cats.length} of ${this.size} cats placed`;
    this.status.textContent = solved ? 'Puzzle solved! Every cat has a room.' : status;
    this.undo.disabled = this.history.length === 0;
    this.reset.disabled = this.history.length === 0;
    this.next.hidden = !solved;
  }

  update(): void {}

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  destroy(): void {
    this.listeners?.abort();
    this.listeners = null;
    this.root?.remove();
    this.root = null;
    this.tiles = [];
    if (this.canvas) this.canvas.classList.toggle('hidden', this.canvasWasHidden);
    this.canvas = null;
  }
}
