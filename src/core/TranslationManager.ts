export interface Language {
  code: string;
  name: string;
  no: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', no: 'No' },
  { code: 'es-ES', name: 'Español', no: 'No' },
  { code: 'fr-FR', name: 'Français', no: 'Non' },
  { code: 'de-DE', name: 'Deutsch', no: 'Nein' },
  { code: 'it-IT', name: 'Italiano', no: 'No' },
  { code: 'ja-JP', name: '日本語', no: 'いいえ' },
];

export class TranslationManager {
  private static currentLanguage: Language = LANGUAGES[0]; // Default to en-US

  public static setLanguage(code: string): void {
    const lang = this.getByCode(code);
    if (lang) {
      this.currentLanguage = lang;
    }
  }

  public static getCurrent(): Language {
    return this.currentLanguage;
  }

  public static getByCode(code: string): Language | undefined {
    const exact = LANGUAGES.find(l => l.code.toLowerCase() === code.toLowerCase());
    if (exact) return exact;

    const prefix = code.split('-')[0].toLowerCase();
    return LANGUAGES.find(l => l.code.split('-')[0].toLowerCase() === prefix);
  }

  public static getRandom(): Language {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const idx = array[0] % LANGUAGES.length;
    return LANGUAGES[idx];
  }
}
