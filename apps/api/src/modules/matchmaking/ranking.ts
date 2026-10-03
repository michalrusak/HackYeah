import type {
  Innovation,
  InnovationMatch,
  Interpretation,
  RelatedInformation,
} from '@repo/api-contracts';

import { MATCHMAKING_RESULT_LIMIT } from '@repo/api-contracts';

export function rankInnovations(
  interpretation: Interpretation,
  catalog: readonly Innovation[],
  limit = MATCHMAKING_RESULT_LIMIT,
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
      if (audiences.length && !matchedAudiences.length) return [];
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
    .slice(0, limit);
}

export function matchInformation(
  interpretation: Interpretation,
  catalog: readonly RelatedInformation[],
): RelatedInformation[] {
  return catalog
    .map((item) => ({
      item,
      sharedAreas: interpretation.areas.filter((area) =>
        item.areas.includes(area),
      ).length,
      sharedNeeds: interpretation.needs.filter((need) =>
        item.needs.includes(need),
      ).length,
    }))
    .filter(
      (match) =>
        match.sharedAreas > 0 ||
        (!interpretation.areas.length && match.sharedNeeds > 0),
    )
    .sort(
      (a, b) =>
        b.sharedAreas - a.sharedAreas ||
        b.sharedNeeds - a.sharedNeeds ||
        (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    )
    .slice(0, 3)
    .map((match) => match.item);
}
