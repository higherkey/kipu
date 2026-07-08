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
   * Checks if a specific language or accent is installed on the system.
   */
  public isLanguageSupported(langCode: string): boolean {
    if (!('speechSynthesis' in window)) return false;
    const voices = window.speechSynthesis.getVoices();
    const normLang = langCode.toLowerCase().replace('_', '-');
    const langFamily = normLang.split('-')[0];

    const regionalFamilies = ['en', 'es', 'pt'];

    if (regionalFamilies.includes(langFamily)) {
      // Must have an exact accent match (e.g. en-au, es-mx)
      return voices.some(v => v.lang.toLowerCase().replace('_', '-') === normLang);
    } else {
      // General family match is fine for non-regionalized entries (e.g. de-DE, ja-JP)
      return voices.some(v => v.lang.toLowerCase().replace('_', '-').startsWith(langFamily));
    }
  }

  /**
   * Speaks the given text using the Web Speech Synthesis API.
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

      // Filter candidate voices that match this language code exactly
      let candidates = voices.filter(v => v.lang.toLowerCase().replace('_', '-') === normLang);

      // If no exact match and it's not a regionalized family, fall back to language prefix match
      const regionalFamilies = ['en', 'es', 'pt'];
      if (candidates.length === 0 && !regionalFamilies.includes(langFamily)) {
        candidates = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(langFamily));
      }

      // Rank candidates to prefer high-quality/neural voices
      const ranked = candidates.map(v => {
        let score = 0;
        const nameLower = v.name.toLowerCase();
        if (nameLower.includes('natural')) score += 60;
        if (nameLower.includes('online')) score += 50;
        if (nameLower.includes('neural')) score += 40;
        if (nameLower.includes('wavenet')) score += 40;
        if (nameLower.includes('google')) score += 30;
        if (nameLower.includes('premium')) score += 20;
        return { voice: v, score };
      });

      if (ranked.length > 0) {
        ranked.sort((a, b) => b.score - a.score);
        utterance.voice = ranked[0].voice;
        utterance.lang = ranked[0].voice.lang;
        console.log(`[AudioController] Selected voice for '${lang}': ${ranked[0].voice.name} (${ranked[0].voice.lang})`);
      }

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoiceAndSpeak();
    } else {
      const voicesChanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
      window.speechSynthesis.onvoiceschanged = voicesChanged;
      
      setTimeout(() => {
        if (window.speechSynthesis.onvoiceschanged === voicesChanged) {
          window.speechSynthesis.speak(utterance);
          window.speechSynthesis.onvoiceschanged = null;
        }
      }, 500);
    }
  }
}
