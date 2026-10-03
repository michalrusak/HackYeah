import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { TesterAiResult, TesterProfileInput } from '@repo/api-contracts';
import { TesterAssignmentEntity, TesterProfileEntity, TesterSearchEntity } from './testers.entities.js';

@Injectable()
export class TestersRepository {
  constructor(
    @InjectRepository(TesterProfileEntity) private readonly profiles: Repository<TesterProfileEntity>,
    @InjectRepository(TesterSearchEntity) private readonly searches: Repository<TesterSearchEntity>,
    @InjectRepository(TesterAssignmentEntity) private readonly assignments: Repository<TesterAssignmentEntity>,
  ) {}

  listProfiles(limit: number): Promise<[TesterProfileEntity[], number]> {
    return this.profiles.findAndCount({
      where: { isActive: true, consent: true },
      order: { updatedAt: 'DESC', id: 'ASC' }, take: limit,
    });
  }

  findOwnProfile(ownerHash: string): Promise<TesterProfileEntity | null> {
    return this.profiles.findOneBy({ ownerHash });
  }

  async saveOwnProfile(ownerHash: string, input: TesterProfileInput): Promise<TesterProfileEntity> {
    await this.profiles.upsert({ ...input, ownerHash }, ['ownerHash']);
    return this.profiles.findOneByOrFail({ ownerHash });
  }

  findActiveProfiles(ids: string[]): Promise<TesterProfileEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.profiles.findBy({ id: In(ids), isActive: true, consent: true });
  }

  saveSearch(input: {
    ownerHash: string; query: string; summary: string; matches: TesterAiResult['matches'];
    candidateCount: number; totalProfiles: number; candidateLimit: number;
  }): Promise<TesterSearchEntity> {
    return this.searches.save(this.searches.create(input));
  }

  findOwnSearch(ownerHash: string, id: string): Promise<TesterSearchEntity | null> {
    return this.searches.findOneBy({ ownerHash, id });
  }

  listOwnSearches(ownerHash: string): Promise<TesterSearchEntity[]> {
    return this.searches.find({ where: { ownerHash }, order: { createdAt: 'DESC' }, take: 50 });
  }

  findAssignments(searchIds: string[]): Promise<TesterAssignmentEntity[]> {
    if (searchIds.length === 0) return Promise.resolve([]);
    return this.assignments.findBy({ searchId: In(searchIds) });
  }

  async assign(searchId: string, profileId: string): Promise<void> {
    await this.assignments.upsert({ searchId, profileId }, ['searchId', 'profileId']);
  }

  async unassign(searchId: string, profileId: string): Promise<void> {
    await this.assignments.delete({ searchId, profileId });
  }
}
