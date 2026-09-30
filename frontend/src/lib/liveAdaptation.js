export const LANGUAGE_MIXES = Object.freeze({
  ENGLISH: 'english',
  MIXED: 'mixed',
  HUNGARIAN: 'hungarian',
});

export const LANGUAGE_MIX_META = {
  english: { short: 'EN', label: 'Végig angolul', description: 'A tanár csak angolul vezet, egyszerűsít ha kell.' },
  mixed: { short: 'MIX', label: 'Vegyes', description: 'Angol az alap, rövid magyar segítséggel.' },
  hungarian: { short: 'HU', label: 'Magyar segítség', description: 'A magyarázat és instrukció magyar, a célmondatok angolok.' },
};

export function normalizeCefr(level = 'B1') {
  const raw = String(level || 'B1').toUpperCase();
  if (raw.startsWith('A1')) return 'A1';
  if (raw.startsWith('A2')) return 'A2';
  if (raw.startsWith('B1')) return 'B1';
  if (raw.startsWith('B2')) return 'B2';
  if (raw.startsWith('C1')) return 'C1';
  return 'B1';
}

export function defaultLanguageMixForCefr(level = 'B1') {
  const cefr = normalizeCefr(level);
  if (cefr === 'A1' || cefr === 'A2') return LANGUAGE_MIXES.MIXED;
  return LANGUAGE_MIXES.ENGLISH;
}

export function defaultPaceForCefr(level = 'B1') {
  return normalizeCefr(level) === 'A1' ? 'slow' : 'normal';
}

export function languageModeForMix(mix = LANGUAGE_MIXES.MIXED) {
  if (mix === LANGUAGE_MIXES.ENGLISH) return 'en';
  if (mix === LANGUAGE_MIXES.HUNGARIAN) return 'hu';
  return null;
}

export function liveDifficultyLabel(level = 'B1') {
  return normalizeCefr(level);
}
