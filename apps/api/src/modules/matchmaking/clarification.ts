import {
  MAX_CLARIFICATION_ROUNDS,
  MATCHMAKING_RESULT_LIMIT,
  type ClarificationAnswer,
  type Interpretation,
  type MatchmakingClarification,
} from '@repo/api-contracts';

export function buildClarification(
  interpretation: Interpretation,
  totalMatches: number,
  answers: readonly ClarificationAnswer[],
): MatchmakingClarification | undefined {
  if (totalMatches > 0 && totalMatches <= MATCHMAKING_RESULT_LIMIT)
    return undefined;
  const asked = new Set(
    answers.map(({ question }) => question.trim().toLocaleLowerCase('pl')),
  );
  const questions = [
    ...interpretation.missingInformation,
    ...(!interpretation.audiences.length
      ? ['Komu przede wszystkim chcesz pomóc? Opisz grupę odbiorców.']
      : []),
    'Jaka jedna trudność jest najważniejsza i co powinno się zmienić?',
    'Opisz konkretną sytuację, w której te osoby potrzebują wsparcia. Co jest wtedy najtrudniejsze?',
    'Co już próbowaliście zrobić i jaka potrzeba nadal pozostaje niezaspokojona?',
  ];
  return {
    reason: totalMatches === 0 ? 'no_matches' : 'too_many_matches',
    question:
      answers.length >= MAX_CLARIFICATION_ROUNDS
        ? null
        : (questions.find(
            (question) => !asked.has(question.trim().toLocaleLowerCase('pl')),
          ) ?? null),
    round: Math.min(answers.length + 1, MAX_CLARIFICATION_ROUNDS),
    maxRounds: MAX_CLARIFICATION_ROUNDS,
    totalMatches,
  };
}
