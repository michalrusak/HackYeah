import { Inject, Injectable } from '@nestjs/common';
import {
  PilotMatchSchema,
  type PilotMatchesData,
  type Interpretation,
} from '@repo/api-contracts';
import { PilotMatchesRepository } from './pilot-matches.repository.js';
import { activePilotConditions } from './pilot-eligibility.js';

@Injectable()
export class PilotMatchesService {
  constructor(
    @Inject(PilotMatchesRepository)
    private readonly repository: PilotMatchesRepository,
  ) {}
  async match(interpretation: Interpretation): Promise<PilotMatchesData> {
    if (!interpretation.needs.length) return { matches: [] };
    const candidates = await this.repository.candidates();
    const matches = candidates.flatMap((listing) => {
      const project = listing.project;
      const conditions = activePilotConditions(project, listing);
      if (!conditions) return [];
      const matchedNeeds = [...new Set(interpretation.needs)].filter((need) =>
        conditions.needs.includes(need),
      );
      const matchedAudiences = [...new Set(interpretation.audiences)].filter(
        (audience) => conditions.audiences.includes(audience),
      );
      if (
        !matchedNeeds.length ||
        (interpretation.audiences.length && !matchedAudiences.length)
      )
        return [];
      return [
        PilotMatchSchema.parse({
          id: project.id,
          title: project.title,
          description: project.description,
          organizerName: project.organizerName,
          requirements: project.requirements,
          mode: project.mode,
          location: project.location,
          conditions,
          matchedNeeds,
          matchedAudiences,
          status: 'testing',
          deploymentApproved: false,
        }),
      ];
    });
    for (const {
      recheckAfter,
      ...pilot
    } of this.repository.externalCandidates()) {
      if (Date.parse(recheckAfter) <= Date.now()) continue;
      if (
        pilot.conditions.recruitmentEndsAt &&
        Date.parse(pilot.conditions.recruitmentEndsAt) <= Date.now()
      )
        continue;
      const matchedNeeds = [...new Set(interpretation.needs)].filter((need) =>
        pilot.conditions.needs.includes(need),
      );
      const matchedAudiences = [...new Set(interpretation.audiences)].filter(
        (audience) => pilot.conditions.audiences.includes(audience),
      );
      if (!matchedNeeds.length || !matchedAudiences.length) continue;
      matches.push(
        PilotMatchSchema.parse({
          ...pilot,
          matchedNeeds,
          matchedAudiences,
        }),
      );
    }
    matches.sort(
      (a, b) =>
        b.matchedNeeds.length - a.matchedNeeds.length ||
        b.matchedAudiences.length - a.matchedAudiences.length ||
        a.id.localeCompare(b.id),
    );
    return { matches: matches.slice(0, 3) };
  }
}
