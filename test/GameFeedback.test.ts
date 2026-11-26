import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteGameFeedback, listGameFeedback } from '../src/core/GameFeedbackStore';
import { GameFeedbackDialog } from '../src/ui/GameFeedbackDialog';
import { GameUI } from '../src/ui/GameUI';
import { SettingsView } from '../src/ui/SettingsView';

vi.mock('../src/core/GameFeedbackStore', () => ({
  saveGameFeedback: vi.fn(),
  listGameFeedback: vi.fn(),
  deleteGameFeedback: vi.fn(),
}));

describe('game feedback entry points', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each([false, true])('preserves the game pause state (already paused: %s)', alreadyPaused => {
    vi.spyOn(GameFeedbackDialog.prototype, 'open').mockImplementation(() => {});
    const onPause = vi.fn();
    const onResume = vi.fn();
    const ui = new GameUI({
      gameId: 'catQuarters',
      gameName: 'Cat Quarters',
      onHome: vi.fn(),
      onPause,
      onResume,
      onRestart: vi.fn(),
      soundEnabled: true,
      vibrationEnabled: true,
      onSoundToggle: vi.fn(),
      onVibrationToggle: vi.fn(),
    });
    ui.mount();
    if (alreadyPaused) ui.pause();
    const button = document.querySelector<HTMLButtonElement>('.feedback-btn')!;
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    button.click();
    expect(document.activeElement).toBe(button);
    expect(ui.isFeedbackOpen()).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(ui.closeFeedback(true)).toBe(true);
    expect(ui.isFeedbackOpen()).toBe(false);
    expect(onResume).toHaveBeenCalledTimes(alreadyPaused ? 0 : 1);
    ui.unmount();
  });

  it('shows local feedback as text in Settings and deletes it with confirmation', async () => {
    vi.mocked(listGameFeedback).mockResolvedValue([
      { id: 1, gameId: 'catQuarters', gameName: 'Cat Quarters', text: '<b>More cats</b>', createdAt: 1 },
    ]);
    vi.mocked(deleteGameFeedback).mockResolvedValue();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = new SettingsView({ onBack: vi.fn() });
    view.mount();

    await vi.waitFor(() => expect(document.querySelector('.feedback-inbox-list p')?.textContent)
      .toBe('<b>More cats</b>'));
    expect(document.querySelector('.feedback-inbox-list b')).toBeNull();
    const remove = document.querySelector<HTMLButtonElement>('.feedback-inbox-list button')!;
    remove.click();
    expect(deleteGameFeedback).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    remove.click();
    await vi.waitFor(() => expect(document.querySelector('.feedback-inbox-list li')).toBeNull());
    expect(deleteGameFeedback).toHaveBeenCalledWith(1);
    view.unmount();
  });
});
