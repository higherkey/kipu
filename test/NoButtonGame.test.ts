import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NoButtonGame } from '../src/games/noButton/NoButtonGame';
import { AudioController } from '../src/core/AudioController';
import { TranslationManager } from '../src/core/TranslationManager';

describe('NoButtonGame (Feature 14 / Issue #34)', () => {
  let game: NoButtonGame;
  let canvas: HTMLCanvasElement;
  let speakSpy: ReturnType<typeof vi.spyOn>;
  let playAudioSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    speakSpy = vi.spyOn(AudioController.prototype, 'speak').mockImplementation(() => {});
    playAudioSpy = vi.spyOn(AudioController.prototype, 'play').mockImplementation(() => {});
    vi.spyOn(AudioController.prototype, 'isLanguageSupported').mockReturnValue(true);

    // Mock speechSynthesis
    (window as any).speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    document.body.innerHTML = '<div id="app"></div>';

    canvas = document.createElement('canvas');
    TranslationManager.setLanguage('en-US');
    game = new NoButtonGame();
    game.init(canvas);
  });

  afterEach(() => {
    game.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should initialize DOM controls, category tabs, and voice controls', () => {
    expect(game).toBeDefined();
    const gameContainer = document.getElementById('no-button-game');
    expect(gameContainer).not.toBeNull();
    expect(gameContainer?.querySelector('#giant-no-button')).not.toBeNull();
    expect(gameContainer?.querySelector('#giant-yes-button')).not.toBeNull();

    // Verify tabs
    expect(gameContainer?.querySelector('#tab-basic')).not.toBeNull();
    expect(gameContainer?.querySelector('#tab-greetings')).not.toBeNull();
    expect(gameContainer?.querySelector('#tab-colors')).not.toBeNull();
    expect(gameContainer?.querySelector('#tab-numbers')).not.toBeNull();
  });

  it('should speak NO when NO button is clicked', () => {
    const noBtn = document.getElementById('giant-no-button') as HTMLButtonElement;
    noBtn.click();

    expect(speakSpy).toHaveBeenCalledWith(
      expect.stringMatching(/no/i),
      expect.any(String),
      expect.objectContaining({ gender: 'auto', pitch: 1.0, rate: 1.0 })
    );
  });

  it('should speak YES when YES button is clicked', () => {
    const yesBtn = document.getElementById('giant-yes-button') as HTMLButtonElement;
    yesBtn.click();

    expect(speakSpy).toHaveBeenCalledWith(
      expect.stringMatching(/yes/i),
      expect.any(String),
      expect.objectContaining({ gender: 'auto', pitch: 1.0, rate: 1.0 })
    );
  });

  it('should switch categories and toggle view visibility', () => {
    expect(game.getCategory()).toBe('basic');
    expect(document.getElementById('view-basic')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('view-greetings')?.classList.contains('hidden')).toBe(true);

    const greetingsTab = document.getElementById('tab-greetings') as HTMLButtonElement;
    greetingsTab.click();

    expect(game.getCategory()).toBe('greetings');
    expect(document.getElementById('view-basic')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('view-greetings')?.classList.contains('hidden')).toBe(false);

    const colorsTab = document.getElementById('tab-colors') as HTMLButtonElement;
    colorsTab.click();
    expect(game.getCategory()).toBe('colors');
    expect(document.getElementById('view-colors')?.classList.contains('hidden')).toBe(false);

    const numbersTab = document.getElementById('tab-numbers') as HTMLButtonElement;
    numbersTab.click();
    expect(game.getCategory()).toBe('numbers');
    expect(document.getElementById('view-numbers')?.classList.contains('hidden')).toBe(false);
  });

  it('should speak greeting when a greeting card is clicked', () => {
    game.setCategory('greetings');
    const firstCard = document.querySelector('.eeno-word-card') as HTMLButtonElement;
    expect(firstCard).not.toBeNull();

    firstCard.click();
    expect(speakSpy).toHaveBeenCalledWith('Hello', 'en-US', expect.any(Object));
  });

  it('should speak color when a color card is clicked', () => {
    game.setCategory('colors');
    const redCard = document.querySelector('.card-red') as HTMLButtonElement;
    expect(redCard).not.toBeNull();

    redCard.click();
    expect(speakSpy).toHaveBeenCalledWith('Red', 'en-US', expect.any(Object));
  });

  it('should speak number when a number button is clicked', () => {
    game.setCategory('numbers');
    const numBtns = document.querySelectorAll('.eeno-number-btn');
    expect(numBtns.length).toBe(10);

    (numBtns[0] as HTMLButtonElement).click();
    expect(speakSpy).toHaveBeenCalledWith('One', 'en-US', expect.any(Object));
  });

  it('should adjust voice gender, pitch, and speed controls', () => {
    const femaleBtn = document.getElementById('voice-gender-female') as HTMLButtonElement;
    femaleBtn.click();
    expect(game.getSelectedGender()).toBe('female');

    const highPitchBtn = document.getElementById('pitch-high') as HTMLButtonElement;
    highPitchBtn.click();
    expect(game.getSelectedPitch()).toBe(1.25);

    const fastSpeedBtn = document.getElementById('speed-fast') as HTMLButtonElement;
    fastSpeedBtn.click();
    expect(game.getSelectedRate()).toBe(1.3);

    // Now speak a word and verify options
    game.speakWord('Test');
    expect(speakSpy).toHaveBeenCalledWith('Test', 'en-US', {
      gender: 'female',
      pitch: 1.25,
      rate: 1.3,
    });
  });

  it('should support Quechua preschool vocabulary', () => {
    TranslationManager.setLanguage('qu-PE');
    game.setCategory('greetings');

    const greetingCards = document.querySelectorAll('.eeno-word-card');
    const helloText = greetingCards[0].querySelector('.eeno-card-text')?.textContent;
    expect(helloText).toBe('Allianllachu');

    (greetingCards[0] as HTMLButtonElement).click();
    expect(speakSpy).toHaveBeenCalledWith('Allianllachu', 'qu-PE', expect.any(Object));

    game.setCategory('colors');
    const redCardText = document.querySelector('.card-red .eeno-card-text')?.textContent;
    expect(redCardText).toBe('Puka');
  });

  it('should gracefully fall back to chime when speechSynthesis is unavailable', () => {
    delete (window as any).speechSynthesis;

    game.speakWord('Fallback');
    expect(playAudioSpy).toHaveBeenCalledWith('synth:bell', 440);
  });

  it('should cancel active speech utterances on destroy', () => {
    const cancelSpy = vi.fn();
    (window as any).speechSynthesis = {
      cancel: cancelSpy,
      speak: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    game.destroy();
    expect(cancelSpy).toHaveBeenCalled();
    expect(document.getElementById('no-button-game')).toBeNull();
  });
});
