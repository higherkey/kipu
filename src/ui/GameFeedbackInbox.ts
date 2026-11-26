import { deleteGameFeedback, listGameFeedback } from '../core/GameFeedbackStore';
import type { GameFeedbackEntry } from '../core/GameFeedbackStore';

export class GameFeedbackInbox {
  private readonly players = new Map<HTMLAudioElement, string>();
  private lifetime = 0;

  async mount(section: HTMLElement): Promise<void> {
    const lifetime = ++this.lifetime;
    const list = section.querySelector<HTMLOListElement>('.feedback-inbox-list')!;
    const status = section.querySelector<HTMLElement>('.feedback-inbox-status')!;
    try {
      const feedback = await listGameFeedback();
      if (this.lifetime !== lifetime) return;
      list.replaceChildren(...feedback.map(entry => this.createEntry(entry, list, status)));
      status.textContent = feedback.length ? '' : 'No feedback yet.';
    } catch {
      if (this.lifetime === lifetime) status.textContent = 'Feedback is unavailable on this device.';
    }
  }

  unmount(): void {
    this.lifetime++;
    for (const player of this.players.keys()) this.releasePlayer(player);
  }

  private releasePlayer(player: HTMLAudioElement): void {
    const url = this.players.get(player);
    if (!url) return;
    player.pause();
    player.removeAttribute('src');
    URL.revokeObjectURL(url);
    this.players.delete(player);
  }

  private createEntry(entry: GameFeedbackEntry, list: HTMLOListElement, status: HTMLElement): HTMLLIElement {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = entry.gameName;
    const date = new Date(entry.createdAt);
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleString();
    item.append(heading, time);

    if (entry.text) {
      const note = document.createElement('p');
      note.textContent = entry.text;
      item.append(note);
    }

    let player: HTMLAudioElement | undefined;
    if (entry.audio instanceof Blob) {
      player = document.createElement('audio');
      const url = URL.createObjectURL(entry.audio);
      this.players.set(player, url);
      player.src = url;
      player.controls = true;
      player.preload = 'none';
      player.setAttribute('aria-label', `Voice memo for ${entry.gameName}`);
      item.append(player);
    }

    const remove = document.createElement('button');
    remove.className = 'settings-btn secondary-btn';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete feedback for ${entry.gameName}`);
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this feedback from this device?')) return;
      remove.disabled = true;
      try {
        await deleteGameFeedback(entry.id);
        if (!item.isConnected) return;
        if (player) this.releasePlayer(player);
        item.remove();
        status.textContent = list.children.length ? 'Feedback deleted.' : 'Feedback deleted. No feedback remains.';
        status.focus();
      } catch {
        if (!item.isConnected) return;
        remove.disabled = false;
        status.textContent = 'Couldn’t delete feedback. Try again.';
      }
    });
    item.append(remove);
    return item;
  }
}
