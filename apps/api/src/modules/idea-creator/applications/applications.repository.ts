import { Inject, Injectable } from '@nestjs/common';
import type { ApplicationAnswers } from '@repo/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service.js';

export interface ApplicationRow {
  id: string;
  ideaId: string;
  grantCallId: string;
  answers: unknown;
  status: string;
  editTokenHash: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ApplicationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: {
    ideaId: string;
    grantCallId: string;
    answers: ApplicationAnswers;
    editTokenHash: string;
  }): Promise<ApplicationRow> {
    return this.prisma.application.create({ data });
  }

  async findById(id: string): Promise<ApplicationRow | null> {
    return this.prisma.application.findUnique({ where: { id } });
  }

  async findDraftFor(
    ideaId: string,
    grantCallId: string,
  ): Promise<ApplicationRow | null> {
    return this.prisma.application.findFirst({
      where: { ideaId, grantCallId, status: 'DRAFT' },
    });
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApplicationRow> {
    return this.prisma.application.update({ where: { id }, data });
  }
}
