import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

export interface GrantCallRow {
  id: string;
  name: string;
  operator: string;
  description: string;
  opensAt: Date;
  closesAt: Date;
  budget: string | null;
  maxGrant: string | null;
  sections: unknown;
}

const callSelect = {
  id: true,
  name: true,
  operator: true,
  description: true,
  opensAt: true,
  closesAt: true,
  budget: true,
  maxGrant: true,
  sections: true,
} as const;

@Injectable()
export class CallsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPublished(): Promise<GrantCallRow[]> {
    return this.prisma.grantCall.findMany({
      where: { isPublished: true },
      orderBy: { opensAt: 'desc' },
      select: callSelect,
    });
  }

  async findById(id: string): Promise<GrantCallRow | null> {
    return this.prisma.grantCall.findFirst({
      where: { id, isPublished: true },
      select: callSelect,
    });
  }
}
