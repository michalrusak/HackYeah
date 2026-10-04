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

export interface AdminGrantCallRow extends GrantCallRow {
  isPublished: boolean;
  applications: { id: string }[];
}

const adminCallSelect = {
  ...callSelect,
  isPublished: true,
  applications: { select: { id: true } },
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

  async findAllForAdmin(): Promise<AdminGrantCallRow[]> {
    return this.prisma.grantCall.findMany({
      orderBy: { createdAt: 'desc' },
      select: adminCallSelect,
    });
  }

  async create(data: {
    name: string;
    operator: string;
    description: string;
    opensAt: Date;
    closesAt: Date;
    budget?: string | null;
    maxGrant?: string | null;
    sections: unknown;
    isPublished?: boolean;
  }): Promise<AdminGrantCallRow> {
    return this.prisma.grantCall.create({
      data: {
        name: data.name,
        operator: data.operator,
        description: data.description,
        opensAt: data.opensAt,
        closesAt: data.closesAt,
        budget: data.budget ?? null,
        maxGrant: data.maxGrant ?? null,
        sections: data.sections as any,
        isPublished: data.isPublished ?? true,
      },
      select: adminCallSelect,
    });
  }

  async togglePublish(id: string, isPublished: boolean): Promise<AdminGrantCallRow | null> {
    const existing = await this.prisma.grantCall.findUnique({ where: { id } });
    if (!existing) return null;
    return this.prisma.grantCall.update({
      where: { id },
      data: { isPublished },
      select: adminCallSelect,
    });
  }

  async createSubscription(email: string, areas: string[]): Promise<{ id: string; email: string; areas: string[] }> {
    return this.prisma.grantAlertSubscription.create({
      data: { email, areas },
      select: { id: true, email: true, areas: true },
    });
  }

  async findAllSubscriptions(): Promise<{ id: string; email: string; areas: string[] }[]> {
    return this.prisma.grantAlertSubscription.findMany({
      select: { id: true, email: true, areas: true },
    });
  }
}
