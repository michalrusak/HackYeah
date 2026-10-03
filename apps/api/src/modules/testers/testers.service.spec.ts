import { Test } from '@nestjs/testing';
import { ErrorCodes, type TesterAiResult } from '@repo/api-contracts';
import type { TesterProfile } from '../../generated/prisma/client.js';
import { TestersAiService } from './testers-ai.service.js';
import {
  TestersRepository,
  type StoredTesterSearch,
} from './testers.repository.js';
import { TestersService } from './testers.service.js';

const profile: TesterProfile = {
  id: '6a233266-1e79-440e-9b12-5668340b576f',
  ownerHash: 'private-owner-hash',
  displayName: 'Tester',
  city: 'Kraków',
  bio: 'Testuję aplikacje przy użyciu mocnego komputera.',
  skills: ['Python'],
  resources: ['RTX 4090'],
  accessibilityNeeds: '',
  interests: ['Edukacja'],
  availability: 'remote',
  consent: true,
  isActive: true,
  isDemo: false,
  createdAt: new Date('2026-10-03T10:00:00.000Z'),
  updatedAt: new Date('2026-10-03T10:00:00.000Z'),
};
const interpretation: TesterAiResult = {
  summary: 'Osoba z komputerem.',
  matches: [
    {
      profileId: profile.id,
      score: 90,
      reason: 'Posiada RTX 4090.',
      matchedTraits: ['RTX 4090'],
    },
  ],
};
const search: StoredTesterSearch = {
  id: '68e4e340-fe02-42d7-ace2-581066de2db5',
  ownerHash: 'search-owner-hash',
  query: 'Szukam osoby z komputerem.',
  ...interpretation,
  matches: interpretation.matches.map((match) => ({
    ...match,
    profileUpdatedAt: profile.updatedAt.toISOString(),
  })),
  candidateCount: 1,
  totalProfiles: 80,
  candidateLimit: 40,
  createdAt: profile.createdAt,
};

describe('TestersService', () => {
  const repository = {
    listProfiles: vi.fn<TestersRepository['listProfiles']>(),
    findOwnProfile: vi.fn<TestersRepository['findOwnProfile']>(),
    saveOwnProfile: vi.fn<TestersRepository['saveOwnProfile']>(),
    findActiveProfiles: vi.fn<TestersRepository['findActiveProfiles']>(),
    saveSearch: vi.fn<TestersRepository['saveSearch']>(),
    findOwnSearch: vi.fn<TestersRepository['findOwnSearch']>(),
    listOwnSearches: vi.fn<TestersRepository['listOwnSearches']>(),
    findAssignments: vi.fn<TestersRepository['findAssignments']>(),
    assign: vi.fn<TestersRepository['assign']>(),
    unassign: vi.fn<TestersRepository['unassign']>(),
  };
  const match = vi.fn<TestersAiService['match']>();
  let service: TestersService;

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.listProfiles.mockResolvedValue([[profile], 80]);
    repository.findOwnProfile.mockResolvedValue(profile);
    repository.findActiveProfiles.mockResolvedValue([profile]);
    repository.saveSearch.mockResolvedValue(search);
    repository.findOwnSearch.mockResolvedValue(search);
    repository.findAssignments.mockResolvedValue([]);
    match.mockResolvedValue(interpretation);
    const module = await Test.createTestingModule({
      providers: [
        TestersService,
        { provide: TestersRepository, useValue: repository },
        { provide: TestersAiService, useValue: { match } },
      ],
    }).compile();
    service = module.get(TestersService);
  });

  it('looks up the owner profile and excludes private identifiers from its response', async () => {
    const outcome = await service.ownProfile('hashed-key');
    expect(repository.findOwnProfile).toHaveBeenCalledWith('hashed-key');
    expect(outcome.body).toMatchObject({
      success: true,
      data: { profile: { id: profile.id } },
    });
    expect(JSON.stringify(outcome)).not.toContain('ownerHash');
    expect(JSON.stringify(outcome)).not.toContain(profile.ownerHash);
  });

  it('stores the real candidate limit and total independently of result count', async () => {
    const outcome = await service.search('hashed-key', search.query);
    expect(repository.listProfiles).toHaveBeenCalledWith(40);
    expect(repository.saveSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerHash: 'hashed-key',
        candidateCount: 1,
        totalProfiles: 80,
        candidateLimit: 40,
        matches: [
          expect.objectContaining({
            profileUpdatedAt: profile.updatedAt.toISOString(),
          }),
        ],
      }),
    );
    expect(outcome.body).toMatchObject({
      success: true,
      data: { candidateCount: 1, totalProfiles: 80, candidateLimit: 40 },
    });
    expect(JSON.stringify(match.mock.calls)).not.toContain('ownerHash');
  });

  it('rejects fabricated matches before saving a search', async () => {
    match.mockResolvedValue({
      ...interpretation,
      matches: [
        {
          ...interpretation.matches[0],
          profileId: 'aee24b68-e6ec-4bd9-b4dc-b94a3827ec68',
        },
      ],
    });
    const outcome = await service.search('hashed-key', search.query);
    expect(outcome).toMatchObject({
      status: 502,
      body: { success: false, error: { code: ErrorCodes.AI_INVALID_RESPONSE } },
    });
    expect(repository.saveSearch).not.toHaveBeenCalled();
  });

  it('does not assign candidates to another owner search', async () => {
    repository.findOwnSearch.mockResolvedValue(null);
    expect(
      (await service.assign('other-owner', search.id, profile.id)).status,
    ).toBe(404);
    expect(repository.findOwnSearch).toHaveBeenCalledWith(
      'other-owner',
      search.id,
    );
    expect(repository.assign).not.toHaveBeenCalled();
  });

  it('hides withdrawn profiles and refuses new assignments to them', async () => {
    repository.findActiveProfiles.mockResolvedValue([]);
    repository.findAssignments.mockResolvedValue([
      {
        id: 'assignment',
        searchId: search.id,
        profileId: profile.id,
        createdAt: profile.createdAt,
      },
    ]);
    const outcome = await service.getSearch('hashed-key', search.id);
    expect(outcome.body).toMatchObject({
      success: true,
      data: { matches: [], assignedProfileIds: [] },
    });
    expect(
      (await service.assign('hashed-key', search.id, profile.id)).status,
    ).toBe(404);
    expect(repository.assign).not.toHaveBeenCalled();
  });

  it('treats legacy results without a profile version as stale', async () => {
    repository.findOwnSearch.mockResolvedValue({
      ...search,
      matches: interpretation.matches,
    });
    const outcome = await service.getSearch('hashed-key', search.id);
    expect(outcome.body).toMatchObject({
      success: true,
      data: { matches: [], assignedProfileIds: [], staleMatchCount: 1 },
    });
    expect(
      (await service.assign('hashed-key', search.id, profile.id)).status,
    ).toBe(404);
    expect(repository.assign).not.toHaveBeenCalled();
  });
});
