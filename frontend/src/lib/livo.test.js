import { extractPracticeInstruction } from './livo';

describe('extractPracticeInstruction live task detection', () => {
  test.each([
    ['Mondd ki: revenue.', { text: 'revenue', kind: 'repeat' }],
    ['Mondd ki ezt a szót angolul: revenue.', { text: 'revenue', kind: 'repeat' }],
    ['Ismételd utánam: compliance.', { text: 'compliance', kind: 'repeat' }],
    ['Mondd el, mit jelent: revenue.', { text: 'revenue', kind: 'meaning' }],
    ['Mit jelent a következő szó: company?', { text: 'company', kind: 'meaning' }],
    ["What's the meaning of the following word: company?", { text: 'company', kind: 'meaning' }],
    ['Hogy mondják angolul, hogy cég?', { text: 'cég', kind: 'translate' }],
    ['How do you say cég in English?', { text: 'cég', kind: 'translate' }],
    ['Mondd ki ezt a szót: company.', { text: 'company', kind: 'repeat' }],
    ['Say this word: company.', { text: 'company', kind: 'repeat' }],
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
