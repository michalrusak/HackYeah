import { Inject, Injectable } from '@nestjs/common';
import {
  TesterAiResultSchema,
  TesterProfileSchema,
  type TesterAiResult,
  type TesterProfileInput,
} from '@repo/api-contracts';
import type {
  TesterAssignment,
  TesterProfile,
  TesterSearch,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type StoredTesterMatch = TesterAiResult['matches'][number] & {
  profileUpdatedAt?: string;
};
export type StoredTesterSearch = Omit<TesterSearch, 'matches'> & {
  matches: StoredTesterMatch[];
};

const StoredTesterMatchesSchema = TesterAiResultSchema.shape.matches.element
  .extend({ profileUpdatedAt: TesterProfileSchema.shape.updatedAt.optional() })
  .array()
  .max(10);

function toStoredSearch(search: TesterSearch): StoredTesterSearch {
  return {
    ...search,
    matches: StoredTesterMatchesSchema.parse(search.matches),
  };
}

@Injectable()
export class TestersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listProfiles(limit: number): Promise<[TesterProfile[], number]> {
    return this.prisma.$transaction([
      this.prisma.testerProfile.findMany({
        where: { isActive: true, consent: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.testerProfile.count({
        where: { isActive: true, consent: true },
      }),
    ]);
  }

  findOwnProfile(ownerHash: string): Promise<TesterProfile | null> {
    return this.prisma.testerProfile.findUnique({ where: { ownerHash } });
  }

  saveOwnProfile(
    ownerHash: string,
    input: TesterProfileInput,
  ): Promise<TesterProfile> {
    return this.prisma.testerProfile.upsert({
      where: { ownerHash },
      create: { ...input, ownerHash, consent: true, isActive: true },
      update: { ...input, consent: true, isActive: true },
    });
  }

  findActiveProfiles(ids: string[]): Promise<TesterProfile[]> {
    return this.prisma.testerProfile.findMany({
      where: { id: { in: ids }, isActive: true, consent: true },
    });
  }

  async saveSearch(input: {
    ownerHash: string;
    query: string;
    summary: string;
    matches: StoredTesterMatch[];
    candidateCount: number;
    totalProfiles: number;
    candidateLimit: number;
  }): Promise<StoredTesterSearch> {
    return toStoredSearch(
      await this.prisma.testerSearch.create({ data: input }),
    );
  }

  async findOwnSearch(
    ownerHash: string,
    id: string,
  ): Promise<StoredTesterSearch | null> {
    const search = await this.prisma.testerSearch.findFirst({
      where: { ownerHash, id },
    });
    return search ? toStoredSearch(search) : null;
  }

  async listOwnSearches(ownerHash: string): Promise<StoredTesterSearch[]> {
    const searches = await this.prisma.testerSearch.findMany({
      where: { ownerHash },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return searches.map(toStoredSearch);
  }

  findAssignments(searchIds: string[]): Promise<TesterAssignment[]> {
    return this.prisma.testerAssignment.findMany({
      where: { searchId: { in: searchIds } },
    });
  }

  async assign(searchId: string, profileId: string): Promise<void> {
    await this.prisma.testerAssignment.upsert({
      where: { searchId_profileId: { searchId, profileId } },
      create: { searchId, profileId },
      update: {},
    });
  }

  async unassign(searchId: string, profileId: string): Promise<void> {
    await this.prisma.testerAssignment.deleteMany({
      where: { searchId, profileId },
    });
  }
}
