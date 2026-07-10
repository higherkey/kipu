import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationManager, LANGUAGES } from '../src/core/TranslationManager';

describe('TranslationManager', () => {
  beforeEach(() => {
    // Reset to default language
    TranslationManager.setLanguage('en-US');
  });

  it('should set and get the current language correctly', () => {
    expect(TranslationManager.getCurrent().code).toBe('en-US');
    
    TranslationManager.setLanguage('fr-FR');
    expect(TranslationManager.getCurrent().code).toBe('fr-FR');
    expect(TranslationManager.getCurrent().no).toBe('Non');
  });

  it('should get language by code prefix', () => {
    const lang = TranslationManager.getByCode('es-MX');
    expect(lang).toBeDefined();
    expect(lang?.code.startsWith('es')).toBe(true);
  });

  it('should return a random language option', () => {
    const randomLang = TranslationManager.getRandom();
    expect(LANGUAGES).toContain(randomLang);
  });

  it('should ignore invalid language codes', () => {
    const previous = TranslationManager.getCurrent();
    TranslationManager.setLanguage('invalid-code');
    expect(TranslationManager.getCurrent()).toBe(previous);
  });
});
