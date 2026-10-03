import { buildClarification } from './clarification.js';
import type { Interpretation } from '@repo/api-contracts';
const interpretation: Interpretation = {
  summary: 'Pomoc lokalnej społeczności.',
  audiences: [],
  areas: [],
  needs: [],
  missingInformation: ['Komu chcecie pomóc?'],
};
describe('clarification policy', () => {
  it('asks a relevant AI question when there are no matches', () => {
    expect(buildClarification(interpretation, 0, [])).toMatchObject({
      reason: 'no_matches',
      question: 'Komu chcecie pomóc?',
      round: 1,
    });
  });
  it('counts the full ranking before the five-result display limit', () => {
    expect(buildClarification(interpretation, 6, [])).toMatchObject({
      reason: 'too_many_matches',
      totalMatches: 6,
    });
    expect(buildClarification(interpretation, 5, [])).toBeUndefined();
    expect(buildClarification(interpretation, 1, [])).toBeUndefined();
  });
  it('does not repeat a question already answered', () => {
    expect(
      buildClarification(interpretation, 0, [
        { question: 'Komu chcecie pomóc?', answer: 'Seniorom.' },
      ])?.question,
    ).not.toBe('Komu chcecie pomóc?');
  });
  it('offers a fallback question when the AI has none and stops after three rounds', () => {
    expect(
      buildClarification({ ...interpretation, missingInformation: [] }, 0, [])
        ?.question,
    ).toContain('Komu');
    const answers = Array.from({ length: 3 }, () => ({
      question: 'Pytanie?',
      answer: 'Odpowiedź.',
    }));
    expect(buildClarification(interpretation, 0, answers)).toMatchObject({
      question: null,
      round: 3,
    });
    expect(buildClarification(interpretation, 9, answers)).toMatchObject({
      question: null,
      reason: 'too_many_matches',
    });
  });
});
