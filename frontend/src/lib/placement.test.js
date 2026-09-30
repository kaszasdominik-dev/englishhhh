import {
  PLACEMENT_QUESTIONS,
  answerPlacementQuestion,
  buildPlacementResult,
  initialPlacementState,
  selectNextQuestion,
} from './placement';

describe('placement engine', () => {
  test('contains a balanced 40-item A1-C1 bank', () => {
    expect(PLACEMENT_QUESTIONS).toHaveLength(40);
    expect(new Set(PLACEMENT_QUESTIONS.map(q => q.cefr))).toEqual(new Set(['A1','A2','B1','B2','C1']));
    expect(new Set(PLACEMENT_QUESTIONS.map(q => q.skill))).toEqual(new Set(['grammar','vocabulary','reading','listening']));
  });

  test('moves ability upward after a correct answer and downward after a wrong answer', () => {
    const start = initialPlacementState();
    const q1 = selectNextQuestion(start);
    const correct = answerPlacementQuestion(start, q1, q1.answer);
    expect(correct.ability).toBeGreaterThan(start.ability);

    const q2 = selectNextQuestion(start);
    const wrong = answerPlacementQuestion(start, q2, '__wrong__');
    expect(wrong.ability).toBeLessThan(start.ability);
  });

  test('builds a CEFR result with per-skill estimates', () => {
    let state = initialPlacementState();
    for (let i = 0; i < 10; i += 1) {
      const item = selectNextQuestion(state);
      state = answerPlacementQuestion(state, item, item.answer);
    }
    const result = buildPlacementResult(state);
    expect(['A1','A2','B1','B2','C1']).toContain(result.cefr);
    expect(result.questionCount).toBe(10);
    expect(result.accuracy).toBe(100);
    expect(Object.keys(result.skills).length).toBeGreaterThan(0);
  });
});
