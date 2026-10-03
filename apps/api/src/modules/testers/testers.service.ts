import { Inject, Injectable } from '@nestjs/common';
import {
  createApiSuccess, ErrorCodes, TesterAiResultSchema,
  type ApiErrorResponse, type ApiSuccessResponse, type MyTesterProfileData,
  type TesterProfile, type TesterProfileInput, type TesterProfilesData,
  type TesterSearchData, type TesterSearchesData,
} from '@repo/api-contracts';
import { TesterAiError, TestersAiService } from './testers-ai.service.js';
import { TesterProfileEntity, TesterSearchEntity } from './testers.entities.js';
import { TestersRepository } from './testers.repository.js';

export interface TesterOutcome<T> {
  status: number;
  body: ApiSuccessResponse<T> | ApiErrorResponse;
}

export function toTesterProfile(profile: TesterProfileEntity): TesterProfile {
  return {
    id: profile.id, displayName: profile.displayName, city: profile.city, bio: profile.bio,
    skills: profile.skills, resources: profile.resources, accessibilityNeeds: profile.accessibilityNeeds,
    interests: profile.interests, availability: profile.availability, consent: profile.consent,
    isActive: profile.isActive, isDemo: profile.isDemo,
    createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString(),
  };
}

function notFound<T>(): TesterOutcome<T> {
  return { status: 404, body: { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Nie znaleziono dostępnego wyszukiwania lub profilu.' } } };
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
    return { status: 200, body: createApiSuccess({ profiles: profiles.map(toTesterProfile), total, limit: 60 }) };
  }

  async ownProfile(ownerHash: string): Promise<TesterOutcome<MyTesterProfileData>> {
    const profile = await this.repository.findOwnProfile(ownerHash);
    return { status: 200, body: createApiSuccess({ profile: profile ? toTesterProfile(profile) : null }) };
  }

  async saveProfile(ownerHash: string, input: TesterProfileInput): Promise<TesterOutcome<MyTesterProfileData>> {
    const profile = await this.repository.saveOwnProfile(ownerHash, input);
    return { status: 200, body: createApiSuccess({ profile: toTesterProfile(profile) }) };
  }

  async search(ownerHash: string, query: string): Promise<TesterOutcome<TesterSearchData>> {
    const [entities, totalProfiles] = await this.repository.listProfiles(this.candidateLimit);
    const profiles = entities.map(toTesterProfile);
    try {
      const interpretation = TesterAiResultSchema.parse(await this.ai.match(query, profiles));
      const ids = interpretation.matches.map((match) => match.profileId);
      const allowed = new Set(profiles.map((profile) => profile.id));
      if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) {
        throw new TesterAiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
      }
      const search = await this.repository.saveSearch({
        ownerHash, query, ...interpretation,
        matches: [...interpretation.matches].sort((a, b) => b.score - a.score),
        candidateCount: profiles.length, totalProfiles, candidateLimit: this.candidateLimit,
      });
      return { status: 200, body: createApiSuccess(await this.searchData(search)) };
    } catch (error) {
      if (!(error instanceof TesterAiError)) throw error;
      return { status: error.status, body: { success: false, error: {
        code: error.code, message: 'Nie udało się wyszukać testerów przy użyciu AI. Spróbuj ponownie.',
      } } };
    }
  }

  async history(ownerHash: string): Promise<TesterOutcome<TesterSearchesData>> {
    const searches = await this.repository.listOwnSearches(ownerHash);
    const assignments = await this.repository.findAssignments(searches.map((search) => search.id));
    const activeIds = new Set((await this.repository.findActiveProfiles(
      searches.flatMap((search) => search.matches.map((match) => match.profileId)),
    )).map((profile) => profile.id));
    return { status: 200, body: createApiSuccess({ searches: searches.map((search) => ({
      id: search.id, query: search.query, summary: search.summary,
      matchCount: search.matches.filter((match) => activeIds.has(match.profileId)).length,
      assignedCount: assignments.filter((assignment) => assignment.searchId === search.id && activeIds.has(assignment.profileId)).length,
      createdAt: search.createdAt.toISOString(),
    })) }) };
  }

  async getSearch(ownerHash: string, id: string): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    if (!search) return notFound();
    return { status: 200, body: createApiSuccess(await this.searchData(search)) };
  }

  async assign(ownerHash: string, id: string, profileId: string): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    if (!search || !search.matches.some((match) => match.profileId === profileId)) return notFound();
    const profiles = await this.repository.findActiveProfiles([profileId]);
    if (profiles.length === 0) return notFound();
    await this.repository.assign(id, profileId);
    return { status: 200, body: createApiSuccess(await this.searchData(search)) };
  }

  async unassign(ownerHash: string, id: string, profileId: string): Promise<TesterOutcome<TesterSearchData>> {
    const search = await this.repository.findOwnSearch(ownerHash, id);
    if (!search) return notFound();
    await this.repository.unassign(id, profileId);
    return { status: 200, body: createApiSuccess(await this.searchData(search)) };
  }

  private async searchData(search: TesterSearchEntity): Promise<TesterSearchData> {
    const [profiles, assignments] = await Promise.all([
      this.repository.findActiveProfiles(search.matches.map((match) => match.profileId)),
      this.repository.findAssignments([search.id]),
    ]);
    const byId = new Map(profiles.map((profile) => [profile.id, toTesterProfile(profile)]));
    return {
      id: search.id, query: search.query, summary: search.summary,
      matches: search.matches.flatMap((match) => {
        const profile = byId.get(match.profileId);
        return profile ? [{ profile, score: match.score, reason: match.reason, matchedTraits: match.matchedTraits }] : [];
      }),
      assignedProfileIds: assignments.filter((assignment) => byId.has(assignment.profileId)).map((assignment) => assignment.profileId),
      candidateCount: search.candidateCount, totalProfiles: search.totalProfiles, candidateLimit: search.candidateLimit,
      createdAt: search.createdAt.toISOString(),
    };
  }
}
