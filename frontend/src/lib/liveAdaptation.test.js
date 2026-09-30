import {
  LANGUAGE_MIXES,
  defaultLanguageMixForCefr,
  defaultPaceForCefr,
  languageModeForMix,
  normalizeCefr,
} from './liveAdaptation';

describe('live CEFR adaptation', () => {
  test('normalizes CEFR bands', () => {
    expect(normalizeCefr('A2+')).toBe('A2');
    expect(normalizeCefr('B1')).toBe('B1');
    expect(normalizeCefr('C1+')).toBe('C1');
  });

  test('beginners default to bilingual support and B1+ to English', () => {
    expect(defaultLanguageMixForCefr('A1')).toBe(LANGUAGE_MIXES.MIXED);
    expect(defaultLanguageMixForCefr('A2')).toBe(LANGUAGE_MIXES.MIXED);
    expect(defaultLanguageMixForCefr('B1')).toBe(LANGUAGE_MIXES.ENGLISH);
    expect(defaultLanguageMixForCefr('B2')).toBe(LANGUAGE_MIXES.ENGLISH);
    expect(defaultLanguageMixForCefr('C1')).toBe(LANGUAGE_MIXES.ENGLISH);
  });

  test('A1 defaults to slow pace', () => {
    expect(defaultPaceForCefr('A1')).toBe('slow');
    expect(defaultPaceForCefr('A2')).toBe('normal');
    expect(defaultPaceForCefr('B1')).toBe('normal');
  });

  test('maps language mix to legacy task-frame language mode', () => {
    expect(languageModeForMix('english')).toBe('en');
    expect(languageModeForMix('hungarian')).toBe('hu');
    expect(languageModeForMix('mixed')).toBeNull();
  });
});
