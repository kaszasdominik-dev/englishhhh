import {
  FIXED_STARTER_TASKS,
  createVocabularyTask,
  liveKindForTask,
  normalizeLearningTask,
  taskToLiveInstruction,
} from './learningTasks';

describe('learning task model', () => {
  test('builds the fixed apple recall task once for both UIs', () => {
    const apple = FIXED_STARTER_TASKS.find(t => t.id === 'fixed_a1_apple');
    expect(apple.display_text).toBe('alma');
    expect(apple.expected_answer).toBe('apple');
    expect(apple.type).toBe('translate_to_english');
    expect(liveKindForTask(apple)).toBe('translate');
    expect(taskToLiveInstruction(apple)).toContain('alma');
  });

  test('normalizes vocabulary review tasks', () => {
    const task = createVocabularyTask({ term: 'supplier', meaning: 'beszállító', cefr: 'B1' });
    expect(task.source).toBe('vocabulary_review');
    expect(task.accepted_answers).toContain('supplier');
    expect(task.spoken_instruction).toContain('beszállító');
  });

  test('preserves explicit accepted answers', () => {
    const task = normalizeLearningTask({
      id: 'x',
      type: 'translate_to_english',
      display_text: 'Tegnap dolgoztam.',
      expected_answer: 'Yesterday I worked.',
      accepted_answers: ['Yesterday I worked.', 'I worked yesterday.'],
    });
    expect(task.accepted_answers).toHaveLength(2);
  });
});
