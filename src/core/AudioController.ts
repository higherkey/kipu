import { Howl } from 'howler';

export class AudioController {
  private static instance: AudioController;
  private readonly sounds: Map<string, Howl> = new Map();

  private constructor() {}

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  public registerSound(id: string, src: string | string[], options?: any) {
    if (!this.sounds.has(id)) {
      this.sounds.set(id, new Howl({ src, ...options }));
    }
  }

  public play(id: string, spriteId?: string) {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.play(spriteId);
    } else {
      console.warn(`Sound '${id}' not found.`);
    }
  }

  /**
   * Speaks the given text using the Web Speech Synthesis API.
   * Handles voice loading fallbacks for cross-browser support.
   */
  public speak(text: string, lang: string): void {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      // Try to find an exact voice match, then fall back to language prefix match
      let voice = voices.find(v => v.lang === lang);
      voice ??= voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (voice) {
        utterance.voice = voice;
      }
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoiceAndSpeak();
    } else {
      // Chrome and other browsers load voices asynchronously
      const voicesChanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
      window.speechSynthesis.onvoiceschanged = voicesChanged;
      
      // Fallback timeout if onvoiceschanged doesn't trigger
      setTimeout(() => {
        if (window.speechSynthesis.onvoiceschanged === voicesChanged) {
          window.speechSynthesis.speak(utterance);
          window.speechSynthesis.onvoiceschanged = null;
        }
      }, 500);
    }
  }
}
