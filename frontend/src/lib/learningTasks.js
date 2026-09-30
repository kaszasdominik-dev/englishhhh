export const TASK_TYPES = Object.freeze({
  TRANSLATE_TO_ENGLISH: 'translate_to_english',
  TRANSLATE_TO_HUNGARIAN: 'translate_to_hungarian',
  REPEAT_AFTER_ME: 'repeat_after_me',
  FREE_ANSWER: 'free_answer',
  READ_ALOUD: 'read_aloud',
  VOCABULARY_RECALL: 'vocabulary_recall',
  PRONUNCIATION: 'pronunciation',
});

const TYPE_TO_LIVE_KIND = {
  translate_to_english: 'translate',
  translate_to_hungarian: 'meaning',
  vocabulary_recall: 'translate',
  repeat_after_me: 'repeat',
  read_aloud: 'repeat',
  pronunciation: 'repeat',
  free_answer: 'repeat',
};

export function normalizeLearningTask(raw = {}) {
  const type = Object.values(TASK_TYPES).includes(raw.type) ? raw.type : TASK_TYPES.REPEAT_AFTER_ME;
  const displayText = String(raw.display_text ?? raw.displayText ?? '').trim();
  const expected = String(raw.expected_answer ?? raw.expectedAnswer ?? '').trim();
  const accepted = Array.isArray(raw.accepted_answers ?? raw.acceptedAnswers)
    ? (raw.accepted_answers ?? raw.acceptedAnswers).map(x => String(x).trim()).filter(Boolean)
    : [];
  const id = String(raw.id || raw.task_id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  return {
    id,
    source: raw.source || 'fixed',
    type,
    skill: raw.skill || 'vocabulary',
    cefr: raw.cefr || 'A1',
    display_text: displayText,
    spoken_instruction: String(raw.spoken_instruction ?? raw.spokenInstruction ?? '').trim(),
    expected_answer: expected,
    accepted_answers: accepted.length ? accepted : (expected ? [expected] : []),
    hint: String(raw.hint || '').trim(),
    difficulty: Number(raw.difficulty || 1),
  };
}

export function liveKindForTask(task) {
  return TYPE_TO_LIVE_KIND[normalizeLearningTask(task).type] || 'repeat';
}

export function taskToLiveInstruction(task) {
  const t = normalizeLearningTask(task);
  if (t.spoken_instruction) return t.spoken_instruction;
  if (t.type === TASK_TYPES.TRANSLATE_TO_ENGLISH || t.type === TASK_TYPES.VOCABULARY_RECALL) {
    return `Mondd ki angolul: ${t.display_text}`;
  }
  if (t.type === TASK_TYPES.TRANSLATE_TO_HUNGARIAN) {
    return `Mondd el magyarul, mit jelent: ${t.display_text}`;
  }
  if (t.type === TASK_TYPES.REPEAT_AFTER_ME || t.type === TASK_TYPES.PRONUNCIATION) {
    return `Ismételd utánam: ${t.display_text}`;
  }
  if (t.type === TASK_TYPES.READ_ALOUD) return `Olvasd fel: ${t.display_text}`;
  return t.display_text;
}

export function createVocabularyTask({ term, meaning, cefr = 'A1', direction = 'hu_en', id, source = 'vocabulary_review' } = {}) {
  if (direction === 'en_hu') {
    return normalizeLearningTask({
      id: id || `vocab_en_hu_${term}`,
      source,
      type: TASK_TYPES.TRANSLATE_TO_HUNGARIAN,
      skill: 'vocabulary',
      cefr,
      display_text: term,
      spoken_instruction: `Mit jelent magyarul: ${term}?`,
      expected_answer: meaning,
      accepted_answers: [meaning],
      difficulty: 1,
    });
  }
  return normalizeLearningTask({
    id: id || `vocab_hu_en_${term}`,
    source,
    type: TASK_TYPES.TRANSLATE_TO_ENGLISH,
    skill: 'vocabulary',
    cefr,
    display_text: meaning,
    spoken_instruction: `Hogy mondanád angolul, hogy ${meaning}?`,
    expected_answer: term,
    accepted_answers: [term],
    hint: term ? `${term[0]}…` : '',
    difficulty: 1,
  });
}

export const FIXED_STARTER_TASKS = [
  createVocabularyTask({ id: 'fixed_a1_apple', term: 'apple', meaning: 'alma', cefr: 'A1', source: 'fixed' }),
  createVocabularyTask({ id: 'fixed_a1_dog', term: 'dog', meaning: 'kutya', cefr: 'A1', source: 'fixed' }),
  createVocabularyTask({ id: 'fixed_a1_house', term: 'house', meaning: 'ház', cefr: 'A1', source: 'fixed' }),
  normalizeLearningTask({
    id: 'fixed_a2_yesterday_worked',
    source: 'fixed',
    type: TASK_TYPES.TRANSLATE_TO_ENGLISH,
    skill: 'grammar',
    cefr: 'A2',
    display_text: 'Tegnap dolgoztam.',
    spoken_instruction: 'Fordítsd angolra: Tegnap dolgoztam.',
    expected_answer: 'Yesterday I worked.',
    accepted_answers: ['Yesterday I worked.', 'I worked yesterday.'],
    hint: 'Yesterday…',
    difficulty: 2,
  }),
  normalizeLearningTask({
    id: 'fixed_b1_for_five_years',
    source: 'fixed',
    type: TASK_TYPES.TRANSLATE_TO_ENGLISH,
    skill: 'grammar',
    cefr: 'B1',
    display_text: 'Öt éve dolgozom itt.',
    spoken_instruction: 'Fordítsd angolra: Öt éve dolgozom itt.',
    expected_answer: "I've worked here for five years.",
    accepted_answers: ["I've worked here for five years.", 'I have worked here for five years.'],
    hint: "I've worked…",
    difficulty: 3,
  }),
  normalizeLearningTask({
    id: 'fixed_b1_compliance_repeat',
    source: 'fixed',
    type: TASK_TYPES.REPEAT_AFTER_ME,
    skill: 'pronunciation',
    cefr: 'B1',
    display_text: 'compliance',
    spoken_instruction: 'Ismételd utánam: compliance.',
    expected_answer: 'compliance',
    accepted_answers: ['compliance'],
    difficulty: 3,
  }),
];
