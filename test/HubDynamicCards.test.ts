import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRegistry } from '../src/core/GameRegistry';
import { Icons } from '../src/ui/Icons';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

import { renderGameList, escapeHtml } from '../src/main';


describe('Hub Dynamic Game Cards & Icons', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-list" class="cards-grid hidden" role="menu"></div>
    `;
  });

  it('renders all registered games when portalId is undefined or "all"', () => {
    const registry = GameRegistry.getInstance();
    renderGameList();

    const cards = document.querySelectorAll('#game-list a');
    expect(cards.length).toBe(registry.getAll().length);
    expect(cards.length).toBeGreaterThanOrEqual(25);
  });

  it('filters games accurately by portal', () => {
    const registry = GameRegistry.getInstance();

    renderGameList('sandbox');
    const sandboxCards = document.querySelectorAll('#game-list a');
    expect(sandboxCards.length).toBe(registry.getByPortal('sandbox').length);
    expect(sandboxCards.length).toBe(5);

    renderGameList('workshop');
    const workshopCards = document.querySelectorAll('#game-list a');
    expect(workshopCards.length).toBe(registry.getByPortal('workshop').length);
    expect(workshopCards.length).toBeGreaterThanOrEqual(7);

    renderGameList('lab');
    const labCards = document.querySelectorAll('#game-list a');
    expect(labCards.length).toBe(registry.getByPortal('lab').length);
    expect(labCards.length).toBe(9);
    expect(document.querySelector('#game-list a[data-game="catQuarters"]')?.getAttribute('href'))
      .toBe('/game/catQuarters');

    renderGameList('busyBoard');
    const busyCards = document.querySelectorAll('#game-list a');
    expect(busyCards.length).toBe(registry.getByPortal('busyBoard').length);
    expect(busyCards.length).toBe(7);
  });

  it('every rendered card has valid attributes, href, and non-empty SVG icon', () => {
    renderGameList();
    const cards = document.querySelectorAll('#game-list a');

    cards.forEach(card => {
      const gameId = card.getAttribute('data-game');
      expect(gameId).toBeTruthy();
      expect(card.getAttribute('href')).toBe(`/game/${gameId}`);
      expect(card.getAttribute('role')).toBe('menuitem');

      const iconSvg = card.querySelector('.icon svg');
      expect(iconSvg).not.toBeNull();
      expect(iconSvg?.getAttribute('viewBox')).toBe('0 0 24 24');

      const title = card.querySelector('.game-title');
      const subtitle = card.querySelector('.game-subtitle');
      expect(title?.textContent?.trim()).toBeTruthy();
      expect(subtitle?.textContent?.trim()).toBeTruthy();
    });
  });

  it('every icon referenced in GameRegistry exists in Icons.ts without falling back to settings', () => {
    const registry = GameRegistry.getInstance();
    const allGames = registry.getAll();

    for (const game of allGames) {
      expect(game.icon in Icons).toBe(true);
      const svg = Icons[game.icon as keyof typeof Icons];
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 24 24"');
    }
  });

  it('correctly escapes HTML in game titles and subtitles', () => {
    expect(escapeHtml('The "No" Button')).toBe('The &quot;No&quot; Button');
    expect(escapeHtml('Latches, Links, & Gears')).toBe('Latches, Links, &amp; Gears');
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});
