import { Howl, Howler } from 'howler';

class SynthEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public play(instrument: string, noteOrFreq: string | number) {
    this.init();
    if (!this.ctx) return;
    
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (!soundEnabled) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const freq = typeof noteOrFreq === 'number' ? noteOrFreq : this.noteToFreq(noteOrFreq);
    if (!freq) return;

    switch (instrument) {
      case 'bell':
        this.playBell(freq);
        break;
      case 'pluck':
        this.playPluck(freq);
        break;
      case 'drum':
        this.playDrum(freq);
        break;
      case 'click':
        this.playClick(freq);
        break;
      case 'chime':
        this.playChime(freq);
        break;
      default:
        this.playBell(freq);
    }
  }

  private noteToFreq(note: string): number {
    const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const match = note.toLowerCase().match(/^([a-g]#?)(\d+)$/);
    if (!match) return 440;
    const name = match[1];
    const octave = parseInt(match[2], 10);
    const index = notes.indexOf(name);
    const key = index + 12 * octave;
    return 440 * Math.pow(2, (key - 57) / 12);
  }

  private playBell(freq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const partials = [1, 2, 2.4, 3, 3.7, 4];
    const gains = [0.4, 0.2, 0.15, 0.1, 0.08, 0.05];
    const decays = [1.2, 0.8, 0.6, 0.4, 0.3, 0.2];

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    masterGain.connect(this.ctx.destination);

    partials.forEach((ratio, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio, now);

      pGain.gain.setValueAtTime(gains[i], now);
      pGain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

      osc.connect(pGain);
      pGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + decays[i]);
    });
  }

  private playPluck(freq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.8;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(freq * 4, now);
    filter.frequency.exponentialRampToValueAtTime(freq, now + 0.2);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playDrum(freq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playClick(freq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  private playChime(freq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }
}

export class AudioController {
  private static instance: AudioController;
  private sounds: Map<string, Howl> = new Map();
  private synth = new SynthEngine();

  private constructor() {
    this.updateMuteState();
  }

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  public updateMuteState() {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    Howler.mute(!soundEnabled);
  }

  public registerSound(id: string, src: string | string[], options?: any) {
    if (!this.sounds.has(id)) {
      this.sounds.set(id, new Howl({ src, ...options }));
    }
  }

  public play(id: string, arg?: string | number) {
    if (id.startsWith('synth:')) {
      const parts = id.split(':');
      const instrument = parts[1];
      this.synth.play(instrument, arg ?? 440);
      return;
    }

    const sound = this.sounds.get(id);
    if (sound) {
      sound.play(typeof arg === 'string' ? arg : undefined);
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
