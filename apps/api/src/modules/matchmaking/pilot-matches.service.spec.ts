import externalPilots from './external-pilots.v1.json' with { type: 'json' };
import { ExternalPilotCatalogSchema } from '@repo/api-contracts';
import { Test } from '@nestjs/testing';
import {
  PilotConditionsSchema,
  type Interpretation,
} from '@repo/api-contracts';
import { PilotMatchesService } from './pilot-matches.service.js';
import {
  PilotMatchesRepository,
  type PilotCandidate,
} from './pilot-matches.repository.js';

const date = new Date('2026-01-01T12:00:00Z');
const conditions = PilotConditionsSchema.parse({
  audiences: ['Osoby w kryzysie bezdomności'],
  needs: ['Dostęp do usług'],
  areas: ['Bezdomność'],
  recruitmentEndsAt: '2099-01-01T12:00:00Z',
  testSchedule: 'Dwa spotkania',
  commitment: 'Dwie godziny i ankieta',
  participants: 'organization',
});
const interpretation: Interpretation = {
  summary: 'Dostęp do punktów pomocy',
  audiences: ['Osoby w kryzysie bezdomności'],
  needs: ['Dostęp do usług'],
  areas: ['Bezdomność'],
  missingInformation: [],
};
function candidate(index = 1): PilotCandidate {
  const id = `96c266b4-ae90-472b-ac84-01a16302512${index}`;
  return {
    projectId: id,
    conditions,
    reviewer: 'private reviewer',
    approvedAt: date,
    reviewedProjectUpdatedAt: date,
    project: {
      id,
      ownerId: 'private owner',
      title: 'Testowy punkt pomocy',
      organizerName: 'Organizator',
      description: 'Opis testu',
      requirements: 'Wymagania testu',
      location: '',
      mode: 'remote',
      stage: 'prototype',
      status: 'open',
      createdAt: date,
      updatedAt: date,
    },
  };
}
describe('pilot matching', () => {
  const candidates = vi.fn<() => Promise<PilotCandidate[]>>();
  let service: PilotMatchesService;
  beforeEach(async () => {
    candidates.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        PilotMatchesService,
        {
          provide: PilotMatchesRepository,
          useValue: { candidates, externalCandidates: () => [] },
        },
      ],
    }).compile();
    service = module.get(PilotMatchesService);
  });
  it('matches needs and audiences, limits to three and never exposes internal approval or owner data', async () => {
    candidates.mockResolvedValue([
      candidate(4),
      candidate(3),
      candidate(2),
      candidate(1),
    ]);
    const result = await service.match(interpretation);
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0]).toMatchObject({
      id: candidate(1).project.id,
      deploymentApproved: false,
      status: 'testing',
      matchedNeeds: ['Dostęp do usług'],
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('excludes closed, changed, expired, malformed and non-prototype projects', async () => {
    const closed = candidate(1);
    closed.project.status = 'closed';
    const changed = candidate(2);
    changed.project.updatedAt = new Date(date.getTime() + 1);
    const expired = candidate(3);
    expired.conditions = {
      ...conditions,
      recruitmentEndsAt: '2000-01-01T00:00:00Z',
    };
    const idea = candidate(4);
    idea.project.stage = 'idea';
    const solution = candidate(5);
    solution.project.stage = 'solution';
    const malformed = candidate(6);
    malformed.conditions = {};
    candidates.mockResolvedValue([
      closed,
      changed,
      expired,
      idea,
      solution,
      malformed,
    ]);
    expect((await service.match(interpretation)).matches).toEqual([]);
  });
  it('does not suggest a project to an unrelated audience or when needs are missing', async () => {
    candidates.mockResolvedValue([candidate()]);
    expect(
      (await service.match({ ...interpretation, audiences: ['Seniorzy'] }))
        .matches,
    ).toEqual([]);
    expect(
      (await service.match({ ...interpretation, needs: ['Ćwiczenie pamięci'] }))
        .matches,
    ).toEqual([]);
    expect(
      (await service.match({ ...interpretation, needs: [] })).matches,
    ).toEqual([]);
  });
  it('matches a sourced autism pilot without inventing a recruitment deadline or Hub account', async () => {
    const repository = {
      candidates: async () => [],
      externalCandidates: () =>
        ExternalPilotCatalogSchema.parse(externalPilots),
    };
    const module = await Test.createTestingModule({
      providers: [
        PilotMatchesService,
        { provide: PilotMatchesRepository, useValue: repository },
      ],
    }).compile();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-04T12:00:00Z'));
    const autism = {
      ...interpretation,
      audiences: ['Osoby w spektrum autyzmu'] as const,
      needs: ['Aktywizacja zawodowa'] as const,
    };
    const input: Interpretation = {
      ...autism,
      audiences: [...autism.audiences],
      needs: [...autism.needs],
    };
    const found = await module.get(PilotMatchesService).match(input);
    expect(found.matches).toHaveLength(1);
    expect(found.matches[0]?.external?.sourceUrl).toContain('linkedin.com');
    expect(found.matches[0]?.conditions.recruitmentEndsAt).toBeNull();
    expect(JSON.stringify(found)).not.toContain('recheckAfter');
    expect(
      (
        await module
          .get(PilotMatchesService)
          .match({ ...input, audiences: ['Seniorzy'] })
      ).matches,
    ).toEqual([]);
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-12-01T00:00:00Z'));
    expect(
      (await module.get(PilotMatchesService).match(input)).matches,
    ).toEqual([]);
    vi.restoreAllMocks();
    await module.close();
  });
  it('propagates a database failure instead of pretending no projects exist', async () => {
    candidates.mockRejectedValue(new Error('unavailable'));
    await expect(service.match(interpretation)).rejects.toThrow('unavailable');
  });
});
