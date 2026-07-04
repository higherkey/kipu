import { Howl } from 'howler';

export class AudioController {
  private static instance: AudioController;
  private sounds: Map<string, Howl> = new Map();

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
      const normLang = lang.toLowerCase().replace('_', '-');
      const langFamily = normLang.split('-')[0];

      // Define preference lists for regional accents
      const accentFallbacks: Record<string, string[]> = {
        'en-au': ['en-au', 'en-nz', 'en-gb', 'en-ie', 'en-ca', 'en-us'],
        'en-nz': ['en-nz', 'en-au', 'en-gb', 'en-ie', 'en-ca', 'en-us'],
        'en-gb': ['en-gb', 'en-ie', 'en-au', 'en-nz', 'en-ca', 'en-us'],
        'en-ie': ['en-ie', 'en-gb', 'en-au', 'en-nz', 'en-ca', 'en-us'],
        'en-us': ['en-us', 'en-ca', 'en-gb', 'en-au', 'en-nz', 'en-ie'],
        'en-ca': ['en-ca', 'en-us', 'en-gb', 'en-au', 'en-nz', 'en-ie'],
        'es-es': ['es-es', 'es-mx', 'es-us', 'es-co', 'es-ar'],
        'es-mx': ['es-mx', 'es-us', 'es-co', 'es-ar', 'es-es'],
        'pt-pt': ['pt-pt', 'pt-br'],
        'pt-br': ['pt-br', 'pt-pt'],
      };

      // Filter and rank candidate voices
      const candidates = voices
        .filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(langFamily))
        .map(v => {
          const voiceLang = v.lang.toLowerCase().replace('_', '-');
          let score = 0;

          // 1. Accent Match Score using preference list
          const preferences = accentFallbacks[normLang];
          if (preferences) {
            const index = preferences.indexOf(voiceLang);
            if (index === 0) {
              score += 200; // Exact match
            } else if (index === 1) {
              score += 150; // 1st fallback
            } else if (index === 2) {
              score += 120; // 2nd fallback
            } else if (index === 3) {
              score += 100; // 3rd fallback
            } else if (index > 3) {
              score += 80;  // Other fallback match
            } else {
              score += 50;  // Not in list but same family
            }
          } else {
            // General language match fallback
            if (voiceLang === normLang) {
              score += 200;
            } else {
              score += 50;
            }
          }

          // 2. Premium/Neural quality indicator keywords
          const nameLower = v.name.toLowerCase();
          if (nameLower.includes('natural')) score += 60;
          if (nameLower.includes('online')) score += 50;
          if (nameLower.includes('neural')) score += 40;
          if (nameLower.includes('wavenet')) score += 40;
          if (nameLower.includes('google')) score += 30;
          if (nameLower.includes('premium')) score += 20;

          return { voice: v, score };
        });

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        utterance.voice = candidates[0].voice;
        utterance.lang = candidates[0].voice.lang;
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
