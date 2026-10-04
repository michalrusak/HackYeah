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
  const question = interpretation.missingInformation[0];
  const options = [...new Set(interpretation.suggestedAnswers ?? [])];
  const questions: { question: string; options: string[] }[] = [
    ...(question && options.length === 3 ? [{ question, options }] : []),
    ...(!interpretation.audiences.length
      ? [
          {
            question: 'Komu przede wszystkim ma pomóc rozwiązanie?',
            options: [
              'Szukam wsparcia dla siebie.',
              'Szukam wsparcia dla bliskiej osoby.',
              'Szukam rozwiązania dla grupy mieszkańców.',
            ],
          },
        ]
      : []),
    {
      question: 'Jaki efekt wsparcia jest dla Ciebie najważniejszy?',
      options: [
        'Łatwiejszy dostęp do potrzebnych usług.',
        'Większa samodzielność w codziennym życiu.',
        'Lepsze relacje i kontakt z innymi ludźmi.',
      ],
    },
    {
      question: 'W jakiej formie wsparcie byłoby najbardziej pomocne?',
      options: [
        'Indywidualna pomoc w codziennych sprawach.',
        'Wspólne zajęcia lub spotkania z innymi.',
        'Materiały lub narzędzia do samodzielnego użycia.',
      ],
    },
    {
      question: 'Na jakim etapie szukania wsparcia jesteś?',
      options: [
        'Dopiero zaczynam i nie wiem, od czego zacząć.',
        'Korzystam już ze wsparcia, ale nie odpowiada ono na moją potrzebę.',
        'Mam sprawdzone rozwiązanie i chcę je dopasować do nowej sytuacji.',
      ],
    },
  ];
  const next =
    answers.length >= MAX_CLARIFICATION_ROUNDS
      ? undefined
      : questions.find(
          (item) => !asked.has(item.question.trim().toLocaleLowerCase('pl')),
        );
  return {
    reason: totalMatches === 0 ? 'no_matches' : 'too_many_matches',
    question: next?.question ?? null,
    options: next?.options ?? [],
    round: Math.min(answers.length + 1, MAX_CLARIFICATION_ROUNDS),
    maxRounds: MAX_CLARIFICATION_ROUNDS,
    totalMatches,
  };
}
