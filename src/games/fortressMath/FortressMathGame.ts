import type { Game } from '../../core/Game';
import { botAction, canCapture, capture, captureCost, createFortressState, endTurn, neighbors, reinforce, type Region } from './FortressRules';
import './FortressMathGame.css';

const PLAYERS = ['You', 'Fox', 'Owl'];
const explorerIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M6 21v-5a6 6 0 0 1 12 0v5Z"/></svg>';
const shieldIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z"/></svg>';

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export class FortressMathGame implements Game {
  private state = createFortressState();
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasWasHidden = false;
  private content: HTMLFieldSetElement | null = null;
  private live: HTMLElement | null = null;
  private pauseNote: HTMLElement | null = null;
  private selected: number | null = null;
  private amount = 1;
  private paused = false;
  private botElapsed = 0;
  private instructionsOpen = false;

  init(canvas: HTMLCanvasElement): void {
    this.destroy();
    this.state = createFortressState();
    this.selected = null;
    this.amount = 1;
    this.paused = false;
    this.botElapsed = 0;
    this.canvas = canvas;
    this.canvasWasHidden = canvas.classList.contains('hidden');
    canvas.classList.add('hidden');
    this.root = document.createElement('section');
    this.root.id = 'fortress-math-game';
    this.root.setAttribute('aria-label', 'Fortress Math');
    this.root.innerHTML = '<div class="fm-wrap"><p class="fm-paused" hidden>Game paused. Use the menu to continue.</p><div class="fm-status" role="status" aria-live="polite" aria-atomic="true"></div><fieldset class="fm-content" aria-label="Kingdom board and actions"></fieldset></div>';
    this.content = this.root.querySelector('fieldset');
    this.live = this.root.querySelector('.fm-status');
    this.pauseNote = this.root.querySelector('.fm-paused');
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('input', this.onInput);
    (document.getElementById('app') ?? canvas.parentElement ?? document.body).append(this.root);
    this.render();
    this.announce('Your turn. Choose a place on the map. You have two actions.');
  }

  update(dt: number): void {
    if (!this.root || this.paused || this.state.winner !== null || this.state.turn === 0) return;
    this.botElapsed += dt;
    if (this.botElapsed < 1000) return;
    this.botElapsed = 0;
    if (this.state.actions === 0) endTurn(this.state);
    else botAction(this.state);
    this.render();
    this.announceTurn();
  }

  pause(): void {
    this.paused = true;
    if (this.content) {
      this.content.disabled = true;
      this.content.inert = true;
    }
    if (this.pauseNote) this.pauseNote.hidden = false;
  }

  resume(): void {
    this.paused = false;
    if (this.content) {
      this.content.disabled = false;
      this.content.inert = false;
    }
    if (this.pauseNote) this.pauseNote.hidden = true;
  }

  destroy(): void {
    this.root?.removeEventListener('click', this.onClick);
    this.root?.removeEventListener('input', this.onInput);
    this.root?.remove();
    if (this.canvas && !this.canvasWasHidden) this.canvas.classList.remove('hidden');
    this.root = null;
    this.canvas = null;
    this.content = null;
    this.live = null;
    this.pauseNote = null;
  }

  private announce(message: string): void {
    if (this.live) this.live.textContent = message;
  }

  private announceTurn(): void {
    if (this.state.winner !== null) {
      this.announce(this.state.winner === 0 ? 'You won! Your five places made a kingdom.' : `${PLAYERS[this.state.winner]} won this kingdom. Play again to try a new plan.`);
      return;
    }
    const latest = this.state.log.at(-1) ?? '';
    this.announce(`${latest} ${this.state.turn === 0 ? 'Your turn. Choose your next action.' : `${PLAYERS[this.state.turn]} is planning.`}`);
  }

  private onClick = (event: MouseEvent): void => {
    if (this.paused) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !this.root?.contains(button) || button.disabled) return;
    if (button.dataset.action === 'restart') {
      this.state = createFortressState();
      this.selected = null;
      this.amount = 1;
      this.botElapsed = 0;
      this.render();
      this.announce('A fresh kingdom! Your turn. Choose a place on the map.');
      this.root?.querySelector<HTMLButtonElement>('[data-region]')?.focus();
      return;
    }
    if (this.state.turn !== 0 || this.state.winner !== null) return;
    if (button.dataset.region !== undefined) {
      this.selected = Number(button.dataset.region);
      this.amount = 1;
      this.render();
      const target = this.state.regions[this.selected];
      if (canCapture(this.state, target.id)) {
        this.root?.querySelector<HTMLElement>('#fortress-amount')?.focus();
      } else if (target.owner === 0) {
        this.root?.querySelector<HTMLElement>('#fortress-reinforce:not(:disabled)')?.focus();
      } else {
        this.root?.querySelector<HTMLElement>(`#fortress-region-${target.id}`)?.focus();
        this.announce(this.captureHint(target));
      }
      return;
    }
    const action = button.dataset.action;
    if (action === 'end-turn') {
      endTurn(this.state);
    } else if (this.selected !== null && action === 'reinforce') {
      if (!reinforce(this.state, this.selected)) return;
    } else if (this.selected !== null && action === 'capture') {
      const target = this.state.regions.find(region => region.id === this.selected);
      if (!target || !capture(this.state, this.selected, this.amount)) {
        this.root?.querySelector('#fortress-amount')?.setAttribute('aria-invalid', 'true');
        this.announce(target ? this.captureHint(target) : 'Choose a place on the map.');
        return;
      }
    } else return;
    if (this.state.turn === 0 && this.state.actions === 0) endTurn(this.state);
    this.botElapsed = 0;
    this.render();
    this.announceTurn();
  };

  private onInput = (event: Event): void => {
    if (this.paused || this.state.turn !== 0) return;
    const input = event.target as HTMLInputElement;
    if (input.id !== 'fortress-amount') return;
    this.amount = input.valueAsNumber;
    const region = this.state.regions.find(place => place.id === this.selected);
    const preview = this.root?.querySelector('#fortress-preview');
    if (region && preview) {
      preview.textContent = this.captureHint(region);
      input.setAttribute('aria-invalid', String(!Number.isInteger(this.amount) || this.amount < captureCost(region) || this.amount > this.state.reserves[0]));
    }
  };

  private captureHint(region: Region): string {
    const adjacent = neighbors(region.id).some(id => this.state.regions.find(place => place.id === id)?.owner === 0);
    if (!adjacent) return 'Choose a neighbor of one of your places. Paths go across or up and down.';
    if (region.owner !== null && this.state.regions.filter(place => place.owner === region.owner).length === 1) return 'This is their last home. It stays safe.';
    if (captureCost(region) > this.state.reserves[0]) return `You need at least ${captureCost(region)} explorers but have ${this.state.reserves[0]} in reserve. Choose another place or end your turn to collect more.`;
    if (!Number.isInteger(this.amount) || this.amount < 1 || this.amount > 20) return 'Choose a whole number from 1 to 20.';
    if (this.amount > this.state.reserves[0]) return `Not enough in reserve. You have ${this.state.reserves[0]} explorers.`;
    const defense = region.troops + region.shields;
    if (this.amount < captureCost(region)) return `Too few yet. Count ${region.troops} defenders + ${region.shields} shields, then add 1. Nothing is spent while you try.`;
    const surplus = this.amount - defense;
    return `${this.amount} sent − ${defense} defense = ${surplus} left. ${Math.min(8, surplus)} will stay here${surplus > 8 ? ' (the limit is 8)' : ''}. Ready to explore!`;
  }

  private regionButton(region: Region): string {
    const owner = region.owner === null ? 'Free' : PLAYERS[region.owner];
    const selected = region.id === this.selected;
    const bordering = neighbors(region.id).map(id => this.state.regions[id].name).join(', ');
    return `<button type="button" id="fortress-region-${region.id}" class="fm-region fm-owner-${region.owner ?? 'free'}${selected ? ' fm-selected' : ''}" data-region="${region.id}" aria-pressed="${selected}" aria-label="${escapeText(region.name)}, ${owner}, ${region.troops} explorers, ${region.shields} shields. Neighbors ${escapeText(bordering)}" ${this.state.turn !== 0 || this.state.winner !== null ? 'disabled' : ''}><span class="fm-region-name">${escapeText(region.name)}</span><strong class="fm-owner">${owner}</strong><span class="fm-counters" aria-hidden="true"><span>${explorerIcon}${region.troops}</span><span>${shieldIcon}${region.shields}</span></span></button>`;
  }

  private actionPanel(): string {
    if (this.state.winner !== null) return `<p class="fm-eyebrow">Kingdom complete</p><h2>${this.state.winner === 0 ? 'You did it!' : `${PLAYERS[this.state.winner]} wins!`}</h2><p>Five places held at the start of a turn. A little planning goes a long way.</p><button type="button" class="fm-primary" id="fortress-restart" data-action="restart">Build another kingdom</button>`;
    if (this.state.turn !== 0) return `<p class="fm-eyebrow">${PLAYERS[this.state.turn]}'s turn</p><h2>A plan is unfolding…</h2><p>${this.state.turn === 1 ? 'Fox likes finding new places.' : 'Owl likes keeping a strong home.'}</p><p>Watch the map. Your turn is coming.</p>`;
    const region = this.state.regions.find(place => place.id === this.selected);
    const heading = region ? escapeText(region.name) : 'Where shall we go?';
    let body = '<p>Choose a place on the map to make your next move.</p><div class="fm-tip">Grow beside your places. Hold <strong>5 places</strong> until your next turn to win.</div>';
    if (region?.owner === 0) {
      const allowed = region.troops <= 6 && this.state.reserves[0] >= 2 && this.state.actions > 0;
      body = `<p>Your place. Help your explorers keep it safe.</p><div class="fm-equation">${region.troops} + 2 = ${region.troops + 2}</div><p>${region.troops > 6 ? 'Only 8 explorers fit in a place. Choose one with 6 or fewer.' : 'Use 2 from reserve to add 2 explorers here.'}</p><button type="button" id="fortress-reinforce" class="fm-primary" data-action="reinforce" ${allowed ? '' : 'disabled'}>Add 2 explorers · costs 2</button>${this.state.reserves[0] < 2 ? '<p>You need 2 explorers in reserve.</p>' : ''}`;
    } else if (region) {
      const legal = canCapture(this.state, region.id);
      body = `<p>Send more explorers than the defense to claim this place.</p><div class="fm-defense"><span><span aria-hidden="true">${explorerIcon.repeat(Math.min(8, region.troops))}</span><strong>${region.troops}</strong> defenders</span><span><span aria-hidden="true">${shieldIcon.repeat(Math.min(8, region.shields))}</span><strong>${region.shields}</strong> shields</span></div><div class="fm-equation" aria-label="${region.troops} plus ${region.shields} plus one equals how many?">${region.troops} + ${region.shields} + 1 = ?</div><p>Extra explorers stay to protect this place, up to 8.</p><label for="fortress-amount">How many explorers will you send?</label><input type="number" id="fortress-amount" min="1" max="20" step="1" inputmode="numeric" value="${Number.isFinite(this.amount) ? this.amount : ''}" aria-describedby="fortress-preview"><p id="fortress-preview" class="fm-preview" aria-live="polite" aria-atomic="true">${this.captureHint(region)}</p><button type="button" id="fortress-capture" class="fm-primary" data-action="capture" ${legal ? '' : 'disabled'}>Send explorers</button>`;
    }
    return `<p class="fm-eyebrow">Your move · ${this.state.actions} action${this.state.actions === 1 ? '' : 's'} left</p><h2>${heading}</h2>${body}<button type="button" class="fm-secondary" id="fortress-end-turn" data-action="end-turn">End my turn</button>`;
  }

  private render(): void {
    if (!this.content) return;
    const active = document.activeElement as HTMLElement | null;
    const focusId = active && this.content.contains(active) ? active.id : '';
    this.instructionsOpen = this.content.querySelector<HTMLDetailsElement>('details')?.open ?? this.instructionsOpen;
    const score = PLAYERS.map((name, index) => `<div class="fm-score fm-score-${index}${this.state.turn === index ? ' fm-current' : ''}"><span>${name}${this.state.turn === index ? ' · turn' : ''}</span><strong>${this.state.regions.filter(region => region.owner === index).length}<small> / 5</small></strong><span>${this.state.reserves[index]} in reserve</span></div>`).join('');
    this.content.innerHTML = `<header class="fm-intro"><div><p class="fm-eyebrow">Fortress Math</p><h1>A little math. A growing kingdom.</h1></div><p>Claim a place. Make a plan.<br>Keep your kingdom growing.</p></header><div class="fm-scoreboard" aria-label="Places and explorer reserves">${score}</div><div class="fm-turnline"><strong>Round ${this.state.round}</strong><span>Hold 5 places at the start of your turn.</span></div><div class="fm-play"><section class="fm-map-section" aria-label="Kingdom map"><div class="fm-map-heading"><h2>Your kingdom map</h2><span>12 places to discover</span></div><div class="fm-map">${this.state.regions.map(region => this.regionButton(region)).join('')}</div><p class="fm-map-key"><span>${explorerIcon} Explorers</span><span>${shieldIcon} Shields</span></p><p class="fm-map-note">Neighboring places touch across, up or down. No diagonal paths.</p></section><section class="fm-actions" aria-label="Plan your move">${this.actionPanel()}</section></div><details class="fm-instructions" ${this.instructionsOpen ? 'open' : ''}><summary id="fortress-help">How to grow your kingdom</summary><ol><li>Take two actions: claim a neighboring place or add explorers to one you own.</li><li>To claim a place, send defenders + shields + at least 1 explorer. The explorers left over stay there, up to 8. Its shields stay, too.</li><li>Adding explorers costs 2 from reserve and adds 2 to your place. A place holds up to 8.</li><li>Every new turn brings 3 explorers to reserve, up to 20. Your last home is always safe.</li><li>Hold 5 places at the start of your turn to win. Take your time. Trying a number spends nothing.</li></ol></details><section class="fm-log" aria-label="Recent turns"><h2>The story so far</h2><ol>${this.state.log.slice(-3).map(entry => `<li>${escapeText(entry)}</li>`).join('') || '<li>Your kingdom begins. Choose your first move.</li>'}</ol></section>`;
    if (focusId) {
      const previous = this.root?.querySelector<HTMLElement>(`#${focusId}:not(:disabled)`);
      const fallback = this.root?.querySelector<HTMLElement>(`[data-region="${this.selected}"]:not(:disabled), #fortress-restart`) ?? this.root?.querySelector<HTMLElement>('#fortress-help');
      (previous ?? fallback)?.focus({ preventScroll: true });
    }
  }
}
