import {
  ExternalPilotCatalogSchema,
  type ExternalPilot,
} from '@repo/api-contracts';
import externalPilots from './external-pilots.v1.json' with { type: 'json' };
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  TesterPilotListing,
  TesterProject,
} from '../../generated/prisma/client.js';

export type PilotCandidate = TesterPilotListing & { project: TesterProject };
@Injectable()
export class PilotMatchesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  externalCandidates(): readonly ExternalPilot[] {
    return ExternalPilotCatalogSchema.parse(externalPilots);
  }
  candidates(): Promise<PilotCandidate[]> {
    return this.prisma.testerPilotListing.findMany({
      where: { project: { status: 'open', stage: 'prototype' } },
      include: { project: true },
    });
  }
}
