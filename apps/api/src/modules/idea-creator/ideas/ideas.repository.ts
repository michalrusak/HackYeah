import { Inject, Injectable } from '@nestjs/common';
import type { CreateIdeaRequest, IdeaListQuery } from '@repo/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IdeaRow } from './idea.mapper.js';

const ideaInclude = {
  visuals: { orderBy: { createdAt: 'desc' }, take: 1 },
  canvas: { select: { id: true } },
} as const;

export interface CreateIdeaData extends CreateIdeaRequest {
  editTokenHash: string;
  adoptedFromId?: string;
}

@Injectable()
export class IdeasRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateIdeaData): Promise<IdeaRow> {
    return this.prisma.idea.create({
      data: {
        title: data.title,
        essence: data.essence,
        problem: data.problem,
        targetAudience: data.targetAudience,
        description: data.description,
        stage: data.stage,
        kind: data.kind,
        region: data.region,
        contactEmail: data.contactEmail === '' ? null : data.contactEmail,
        audiences: data.audiences,
        areas: data.areas,
        needs: data.needs,
        editTokenHash: data.editTokenHash,
        adoptedFromId: data.adoptedFromId ?? null,
      },
      include: ideaInclude,
    });
  }

  async findById(id: string): Promise<IdeaRow | null> {
    return this.prisma.idea.findUnique({ where: { id }, include: ideaInclude });
  }

  /** Publiczna lista pokazuje wyłącznie fiszki opublikowane. */
  async findPublished(
    query: IdeaListQuery,
  ): Promise<{ items: IdeaRow[]; total: number }> {
    const where = {
      status: 'PUBLISHED' as const,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.audience ? { audiences: { has: query.audience } } : {}),
      ...(query.area ? { areas: { has: query.area } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { essence: { contains: query.q, mode: 'insensitive' as const } },
              { problem: { contains: query.q, mode: 'insensitive' as const } },
              {
                targetAudience: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.idea.findMany({
        where,
        include: ideaInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.idea.count({ where }),
    ]);
    return { items, total };
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<IdeaRow> {
    return this.prisma.idea.update({
      where: { id },
      data,
      include: ideaInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.idea.delete({ where: { id } });
  }
}
