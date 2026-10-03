import { Inject, Injectable } from '@nestjs/common';
import {
  createApiSuccess,
  ErrorCodes,
  TesterAiResultSchema,
  TesterProfileSchema,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type MyTesterProfileData,
  type TesterProfile,
  type TesterProfileInput,
  type TesterProfilesData,
  type TesterSearchData,
  type TesterSearchesData,
} from '@repo/api-contracts';
import { TesterAiError, TestersAiService } from './testers-ai.service.js';
import type { TesterProfile as StoredTesterProfile } from '../../generated/prisma/client.js';
import {
  TestersRepository,
  type StoredTesterMatch,
  type StoredTesterSearch,
} from './testers.repository.js';

export interface TesterOutcome<T> {
  status: number;
  body: ApiSuccessResponse<T> | ApiErrorResponse;
}

export function toTesterProfile(profile: StoredTesterProfile): TesterProfile {
  return TesterProfileSchema.parse({
    id: profile.id,
    displayName: profile.displayName,
    city: profile.city,
    bio: profile.bio,
    skills: profile.skills,
    resources: profile.resources,
    accessibilityNeeds: profile.accessibilityNeeds,
    interests: profile.interests,
    availability: profile.availability,
    consent: profile.consent,
    isActive: profile.isActive,
    isDemo: profile.isDemo,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  });
}

function notFound<T>(): TesterOutcome<T> {
  return {
    status: 404,
    body: {
      success: false,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Nie znaleziono dostępnego wyszukiwania lub profilu.',
      },
    },
  };
}

function isCurrentMatch(
  match: StoredTesterMatch,
  updatedAt: string | undefined,
): boolean {
  return updatedAt !== undefined && match.profileUpdatedAt === updatedAt;
}

@Injectable()
export class TestersService {
  private readonly candidateLimit = 40;
  constructor(
    @Inject(TestersRepository) private readonly repository: TestersRepository,
    @Inject(TestersAiService) private readonly ai: TestersAiService,
  ) {}

  async profiles(): Promise<TesterOutcome<TesterProfilesData>> {
    const [profiles, total] = await this.repository.listProfiles(60);
    return {
      status: 200,
      body: createApiSuccess({
        profiles: profiles.map(toTesterProfile),
        total,
        limit: 60,
      }),
    };
  }

  async ownProfile(
    ownerHash: string,
  ): Promise<TesterOutcome<MyTesterProfileData>> {
    const profile = await this.repository.findOwnProfile(ownerHash);
    return {
      status: 200,
      body: createApiSuccess({
        profile: profile ? toTesterProfile(profile) : null,
      }),
    };
  }

  async saveProfile(
    ownerHash: string,
    input: TesterProfileInput,
  ): Promise<TesterOutcome<MyTesterProfileData>> {
    const profile = await this.repository.saveOwnProfile(ownerHash, input);
    return {
      status: 200,
      body: createApiSuccess({ profile: toTesterProfile(profile) }),
    };
  }

  async search(
    ownerHash: string,
    query: string,
  ): Promise<TesterOutcome<TesterSearchData>> {
    const [entities, totalProfiles] = await this.repository.listProfiles(
      this.candidateLimit,
    );
    const profiles = entities.map(toTesterProfile);
    try {
      const interpretation = TesterAiResultSchema.parse(
        await this.ai.match(query, profiles),
      );
      const ids = interpretation.matches.map((match) => match.profileId);
      const byId = new Map(profiles.map((profile) => [profile.id, profile]));
      if (new Set(ids).size !== ids.length) {
        throw new TesterAiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
      }
      const matches = interpretation.matches
        .map((match) => {
          const profile = byId.get(match.profileId);
          if (!profile)
            throw new TesterAiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
          return { ...match, profileUpdatedAt: profile.updatedAt };
        })
        .sort((a, b) => b.score - a.score);
      const search = await this.repository.saveSearch({
        ownerHash,
        query,
        ...interpretation,
        matches,
        candidateCount: profiles.length,
        totalProfiles,
        candidateLimit: this.candidateLimit,
      });
      return {
        status: 200,
        body: createApiSuccess(await this.searchData(search)),
      };
    } catch (error) {
      if (!(error instanceof TesterAiError)) throw error;
      return {
        status: error.status,
        body: {
          success: false,
          error: {
            code: error.code,
            message:
              'Nie udało się wyszukać testerów przy użyciu AI. Spróbuj ponownie.',
          },
        },
      };
    }
  }

  async history(ownerHash: string): Promise<TesterOutcome<TesterSearchesData>> {
    const searches = await this.repository.listOwnSearches(ownerHash);
    const assignments = await this.repository.findAssignments(
      searches.map((search) => search.id),
    );
    const activeVersions = new Map(
      (
        await this.repository.findActiveProfiles(
          searches.flatMap((search) =>
            search.matches.map((match) => match.profileId),
          ),
        )
      ).map((profile) => [profile.id, profile.updatedAt.toISOString()]),
    );
    return {
      status: 200,
      body: createApiSuccess({
        searches: searches.map((search) => {
          const currentIds = new Set(
            search.matches
              .filter((match) =>
                isCurrentMatch(match, activeVersions.get(match.profileId)),
              )
              .map((match) => match.profileId),
          );
          return {
            id: search.id,
            query: search.query,
            summary: search.summary,
            matchCount: currentIds.size,
            assignedCount: assignments.filter(
              (assignment) =>
                assignment.searchId === search.id &&
                currentIds.has(assignment.profileId),
            ).length,
            createdAt: search.createdAt.toISOString(),
          };
        }),
      }),
    };
  }

  async getSearch(
    ownerHash: string,
    id: string,
  ): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    if (!search) return notFound();
    return {
      status: 200,
      body: createApiSuccess(await this.searchData(search)),
    };
  }

  async assign(
    ownerHash: string,
    id: string,
    profileId: string,
  ): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    const match = search?.matches.find((item) => item.profileId === profileId);
    if (!search || !match) return notFound();
    const profiles = await this.repository.findActiveProfiles([profileId]);
    if (!isCurrentMatch(match, profiles[0]?.updatedAt.toISOString()))
      return notFound();
    await this.repository.assign(id, profileId);
    return {
      status: 200,
      body: createApiSuccess(await this.searchData(search)),
    };
  }

  async unassign(
    ownerHash: string,
    id: string,
    profileId: string,
  ): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    if (!search) return notFound();
    await this.repository.unassign(id, profileId);
    return {
      status: 200,
      body: createApiSuccess(await this.searchData(search)),
    };
  }

  private async searchData(
    search: StoredTesterSearch,
  ): Promise<TesterSearchData> {
    const [profiles, assignments] = await Promise.all([
      this.repository.findActiveProfiles(
        search.matches.map((match) => match.profileId),
      ),
      this.repository.findAssignments([search.id]),
    ]);
    const byId = new Map(
      profiles.map((profile) => [profile.id, toTesterProfile(profile)]),
    );
    const matches = search.matches.flatMap((match) => {
      const profile = byId.get(match.profileId);
      return profile && isCurrentMatch(match, profile.updatedAt)
        ? [
            {
              profile,
              score: match.score,
              reason: match.reason,
              matchedTraits: match.matchedTraits,
            },
          ]
        : [];
    });
    const currentIds = new Set(matches.map((match) => match.profile.id));
    return {
      id: search.id,
      query: search.query,
      summary: search.summary,
      matches,
      assignedProfileIds: assignments
        .filter((assignment) => currentIds.has(assignment.profileId))
        .map((assignment) => assignment.profileId),
      staleMatchCount: search.matches.length - matches.length,
      candidateCount: search.candidateCount,
      totalProfiles: search.totalProfiles,
      candidateLimit: search.candidateLimit,
      createdAt: search.createdAt.toISOString(),
    };
  }
}
