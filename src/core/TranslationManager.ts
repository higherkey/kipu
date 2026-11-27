export interface PreschoolVocabulary {
  hello: string;
  bye: string;
  please: string;
  thankYou: string;
  colors: {
    red: string;
    blue: string;
    yellow: string;
    green: string;
  };
  numbers: string[]; // 1 to 10
}

export interface LanguageOption {
  code: string;
  name: string;
  englishName: string;
  yes: string;
  no: string;
  vocab?: PreschoolVocabulary;
}

export const DEFAULT_PRESCHOOL_VOCAB: PreschoolVocabulary = {
  hello: 'Hello',
  bye: 'Bye',
  please: 'Please',
  thankYou: 'Thank you',
  colors: {
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow',
    green: 'Green',
  },
  numbers: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'],
};

const SPANISH_VOCAB: PreschoolVocabulary = {
  hello: 'Hola',
  bye: 'Adiós',
  please: 'Por favor',
  thankYou: 'Gracias',
  colors: {
    red: 'Rojo',
    blue: 'Azul',
    yellow: 'Amarillo',
    green: 'Verde',
  },
  numbers: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'],
};

const QUECHUA_VOCAB: PreschoolVocabulary = {
  hello: 'Allianllachu',
  bye: 'Tupananchiskama',
  please: 'Allichu',
  thankYou: 'Sulpayki',
  colors: {
    red: 'Puka',
    blue: 'Anqas',
    yellow: "Q'illu",
    green: "Q'umer",
  },
  numbers: ['Huk', 'Iskay', 'Kimsa', 'Tawa', 'Pichqa', 'Suqta', 'Qanchis', 'Pusaq', 'Isqun', 'Chunka'],
};

export const LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', englishName: '', yes: 'Yes', no: 'No', vocab: DEFAULT_PRESCHOOL_VOCAB },
  { code: 'en-GB', name: 'English (UK)', englishName: '', yes: 'Yes', no: 'No', vocab: DEFAULT_PRESCHOOL_VOCAB },
  { code: 'en-AU', name: 'English (Australia)', englishName: '', yes: 'Yes', no: 'No', vocab: DEFAULT_PRESCHOOL_VOCAB },
  { code: 'es-ES', name: 'Español (España)', englishName: 'Spanish (Spain)', yes: 'Sí', no: 'No', vocab: SPANISH_VOCAB },
  { code: 'es-MX', name: 'Español (México)', englishName: 'Spanish (Mexico)', yes: 'Sí', no: 'No', vocab: SPANISH_VOCAB },
  {
    code: 'qu-PE',
    name: 'Runa Simi (Quechua)',
    englishName: 'Quechua',
    yes: 'Arí',
    no: 'Manan',
    vocab: QUECHUA_VOCAB,
  },
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

  public static getVocabForLanguage(code: string): PreschoolVocabulary {
    const lang = TranslationManager.getByCode(code);
    return lang?.vocab || DEFAULT_PRESCHOOL_VOCAB;
  }

  public static getRandom(): LanguageOption {
    const idx = Math.floor(Math.random() * LANGUAGES.length);
    return LANGUAGES[idx];
  }
}
