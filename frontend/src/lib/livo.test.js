import { extractPracticeInstruction } from './livo';

describe('extractPracticeInstruction live task detection', () => {
  test.each([
    ['Mondd ki: revenue.', { text: 'revenue', kind: 'repeat' }],
    ['Mondd ki ezt a szót angolul: revenue.', { text: 'revenue', kind: 'repeat' }],
    ['Ismételd utánam: compliance.', { text: 'compliance', kind: 'repeat' }],
    ['Mondd el, mit jelent: revenue.', { text: 'revenue', kind: 'meaning' }],
    ['Mit jelent a revenue?', { text: 'revenue', kind: 'meaning' }],
    ['What does revenue mean?', { text: 'revenue', kind: 'meaning' }],
    ['Fordítsd angolra: bevétel.', { text: 'bevétel', kind: 'translate' }],
    ['Mondd angolul: alma.', { text: 'alma', kind: 'translate' }],
  ])('%s', (input, expected) => {
    expect(extractPracticeInstruction(input)).toEqual(expected);
  });

  test('ignores ordinary tutor statements', () => {
    expect(extractPracticeInstruction('A revenue jelentése bevétel. Nézzünk egy példát.')).toBeNull();
  });
});
