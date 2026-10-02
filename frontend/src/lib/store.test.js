import { normalizeState } from './store';

describe('normalizeState', () => {
  test('fills missing profile and collection fields so views never crash on stale state', () => {
    const state = normalizeState({ user: { onboarded: true } });
    expect(state.user.onboarded).toBe(true);
    expect(state.profile).toBeDefined();
    expect(Array.isArray(state.vocabulary)).toBe(true);
    expect(Array.isArray(state.grammar)).toBe(true);
    expect(Array.isArray(state.sessions)).toBe(true);
    expect(Array.isArray(state.homework)).toBe(true);
    expect(Array.isArray(state.practiceFocus)).toBe(true);
  });

  test('replaces malformed collection fields with arrays', () => {
    const state = normalizeState({
      vocabulary: null,
      grammar: {},
      sessions: 'bad',
      homework: 123,
      practiceFocus: false,
    });
    expect(state.vocabulary).toEqual([]);
    expect(state.grammar).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.homework).toEqual([]);
    expect(state.practiceFocus).toEqual([]);
  });
});
