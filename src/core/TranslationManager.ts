export interface LanguageOption {
  code: string;
  name: string;
  englishName: string;
  yes: string;
  no: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', englishName: '', yes: 'Yes', no: 'No' },
  { code: 'en-GB', name: 'English (UK)', englishName: '', yes: 'Yes', no: 'No' },
  { code: 'en-AU', name: 'English (Australia)', englishName: '', yes: 'Yes', no: 'No' },
  { code: 'es-ES', name: 'Español (España)', englishName: 'Spanish (Spain)', yes: 'Sí', no: 'No' },
  { code: 'es-MX', name: 'Español (México)', englishName: 'Spanish (Mexico)', yes: 'Sí', no: 'No' },
  { code: 'fr-FR', name: 'Français', englishName: 'French', yes: 'Oui', no: 'Non' },
  { code: 'de-DE', name: 'Deutsch', englishName: 'German', yes: 'Ja', no: 'Nein' },
  { code: 'it-IT', name: 'Italiano', englishName: 'Italian', yes: 'Sì', no: 'No' },
  { code: 'pt-BR', name: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', yes: 'Sim', no: 'Não' },
  { code: 'ja-JP', name: '日本語', englishName: 'Japanese', yes: 'はい', no: 'いいえ' },
  { code: 'ko-KR', name: '한국어', englishName: 'Korean', yes: '네', no: '아니요' },
  { code: 'zh-CN', name: '中文 (简体)', englishName: 'Chinese (Simplified)', yes: '是', no: '不' },
  { code: 'ru-RU', name: 'Русский', englishName: 'Russian', yes: 'Да', no: 'Нет' },
];

/**
 * Manages the active language selection for the No Button game.
 * Singleton-style static class for global language state.
 */
export class TranslationManager {
  private static current: LanguageOption = LANGUAGES[0];

  public static setLanguage(code: string): void {
    const found = LANGUAGES.find(l => l.code === code);
    if (found) {
      TranslationManager.current = found;
    }
  }

  public static getCurrent(): LanguageOption {
    return TranslationManager.current;
  }

  public static getByCode(code: string): LanguageOption | undefined {
    // Try exact match first, then language-family match
    return (
      LANGUAGES.find(l => l.code.toLowerCase() === code.toLowerCase()) ||
      LANGUAGES.find(l => l.code.toLowerCase().startsWith(code.toLowerCase().split('-')[0]))
    );
  }

  public static getRandom(): LanguageOption {
    const idx = Math.floor(Math.random() * LANGUAGES.length);
    return LANGUAGES[idx];
  }
}
