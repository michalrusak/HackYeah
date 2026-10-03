import type {
  Innovation,
  InnovationMatch,
  Interpretation,
} from '@repo/api-contracts';

export function rankInnovations(
  interpretation: Interpretation,
  catalog: readonly Innovation[],
): InnovationMatch[] {
  const needs = [...new Set(interpretation.needs)];
  const audiences = [...new Set(interpretation.audiences)];
  const areas = [...new Set(interpretation.areas)];
  if (!needs.length) return [];

  const weight = 50 + (audiences.length ? 30 : 0) + (areas.length ? 20 : 0);
  return catalog
    .flatMap((innovation): InnovationMatch[] => {
      const matchedNeeds = needs.filter((need) =>
        innovation.needs.includes(need),
      );
      if (!matchedNeeds.length) return [];
      const matchedAudiences = audiences.filter((audience) =>
        innovation.audiences.includes(audience),
      );
      const matchedAreas = areas.filter((area) =>
        innovation.areas.includes(area),
      );
      const points =
        (50 * matchedNeeds.length) / needs.length +
        (audiences.length
          ? (30 * matchedAudiences.length) / audiences.length
          : 0) +
        (areas.length ? (20 * matchedAreas.length) / areas.length : 0);
      const score = Math.round((points / weight) * 10000) / 100;
      return [
        {
          ...innovation,
          score,
          level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'partial',
          matchedNeeds,
          explanation: [
            `Wspólne potrzeby: ${matchedNeeds.join(', ')}.`,
            ...(matchedAudiences.length
              ? [`Odbiorcy: ${matchedAudiences.join(', ')}.`]
              : []),
            ...(matchedAreas.length
              ? [`Obszary: ${matchedAreas.join(', ')}.`]
              : []),
          ].join(' '),
        },
      ];
    })
    .sort(
      (a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, 5);
}
