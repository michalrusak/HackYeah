import { Inject, Injectable } from '@nestjs/common';
import {
  KnowledgeResourceSchema,
  type KnowledgeInput,
  type KnowledgeQuery,
  type KnowledgeResource,
  type Need,
  type NeedSource,
  type SocialArea,
} from '@repo/api-contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

function resource(row: { updatedAt: Date }): KnowledgeResource {
  return KnowledgeResourceSchema.strip().parse({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  });
}

@Injectable()
export class KnowledgeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: KnowledgeQuery, admin = false, staleBefore?: string) {
    const where: Prisma.KnowledgeResourceWhereInput = {
      ...(admin
        ? {
            ...(query.status ? { status: query.status } : {}),
            ...(query.stale && staleBefore
              ? { verifiedAt: { lt: staleBefore } }
              : {}),
          }
        : { status: 'published' }),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.area ? { areas: { has: query.area } } : {}),
      ...(query.audience ? { audiences: { has: query.audience } } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      AND: [
        ...(query.video
          ? [
              {
                OR: [
                  { videoUrl: { not: null } },
                  { videoPageUrl: { not: null } },
                ],
              },
            ]
          : []),
        ...(query.q
          ? [
              {
                OR: [
                  {
                    title: { contains: query.q, mode: 'insensitive' as const },
                  },
                  {
                    summary: {
                      contains: query.q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.knowledgeResource.findMany({
        where,
        orderBy: [{ verifiedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.knowledgeResource.count({ where }),
    ]);
    return {
      resources: rows.map(resource),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async summary(staleBefore: string) {
    const [published, draft, stale] = await this.prisma.$transaction([
      this.prisma.knowledgeResource.count({ where: { status: 'published' } }),
      this.prisma.knowledgeResource.count({ where: { status: 'draft' } }),
      this.prisma.knowledgeResource.count({
        where: { verifiedAt: { lt: staleBefore } },
      }),
    ]);
    return { published, draft, stale, staleBefore };
  }

  async published(): Promise<KnowledgeResource[]> {
    const rows = await this.prisma.knowledgeResource.findMany({
      where: { status: 'published' },
      orderBy: { id: 'asc' },
    });
    return rows.map(resource);
  }

  async overviewRows() {
    return this.prisma.knowledgeResource.findMany({
      where: { status: 'published' },
      select: { areas: true, updatedAt: true },
    });
  }

  async find(id: string, admin = false): Promise<KnowledgeResource | null> {
    const row = await this.prisma.knowledgeResource.findFirst({
      where: { id, ...(admin ? {} : { status: 'published' }) },
    });
    return row ? resource(row) : null;
  }

  async create(input: KnowledgeInput): Promise<KnowledgeResource | null> {
    try {
      return resource(
        await this.prisma.knowledgeResource.create({ data: input }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    }
  }

  async update(
    input: KnowledgeInput,
    revision: number,
  ): Promise<KnowledgeResource | null> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.knowledgeResource.updateMany({
        where: { id: input.id, revision },
        data: { ...input, revision: { increment: 1 } },
      });
      if (!result.count) return null;
      const row = await tx.knowledgeResource.findUniqueOrThrow({
        where: { id: input.id },
      });
      return resource(row);
    });
  }

  async importDrafts(inputs: KnowledgeInput[]): Promise<number> {
    const result = await this.prisma.knowledgeResource.createMany({
      data: inputs.map((input) => ({ ...input, status: 'draft' })),
      skipDuplicates: true,
    });
    return result.count;
  }

  // `id` deduplikuje ponowienia formularza; `phrase` to znormalizowana fraza wyszukiwania.
  async recordNeed(
    input: { id?: string; areas: SocialArea[]; needs: Need[]; phrase?: string },
    day: Date,
    source: NeedSource = 'form',
  ): Promise<void> {
    const { id, phrase } = input;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (id) await tx.needReceipt.create({ data: { id, createdAt: day } });
        await tx.needDailyCount.upsert({
          where: { day },
          create: { day, count: 1 },
          update: { count: { increment: 1 } },
        });
        await tx.needSourceCount.upsert({
          where: { day_source: { day, source } },
          create: { day, source, count: 1 },
          update: { count: { increment: 1 } },
        });
        if (phrase)
          await tx.searchPhraseCount.upsert({
            where: { day_phrase: { day, phrase } },
            create: { day, phrase, count: 1 },
            update: { count: { increment: 1 } },
          });
        for (const area of input.areas) {
          await tx.needAreaCount.upsert({
            where: { day_area: { day, area } },
            create: { day, area, count: 1 },
            update: { count: { increment: 1 } },
          });
        }
        for (const need of input.needs) {
          await tx.needTagCount.upsert({
            where: { day_need: { day, need } },
            create: { day, need, count: 1 },
            update: { count: { increment: 1 } },
          });
        }
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
    }
  }

  async trendRows(from: Date, until: Date) {
    const where = { day: { gte: from, lt: until } };
    const [daily, areas, needs, sources, phrases] =
      await this.prisma.$transaction([
        this.prisma.needDailyCount.findMany({
          where,
          select: { day: true, count: true },
          orderBy: { day: 'asc' },
        }),
        this.prisma.needAreaCount.findMany({
          where,
          select: { day: true, area: true, count: true },
        }),
        this.prisma.needTagCount.findMany({
          where,
          select: { day: true, need: true, count: true },
        }),
        this.prisma.needSourceCount.findMany({
          where,
          select: { day: true, source: true, count: true },
        }),
        this.prisma.searchPhraseCount.findMany({
          where,
          select: { day: true, phrase: true, count: true },
        }),
      ]);
    return { daily, areas, needs, sources, phrases };
  }

  async createSession(
    id: string,
    csrfToken: string,
    expiresAt: Date,
    credentialVersion: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.knowledgeAdminSession.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      }),
      this.prisma.knowledgeAdminSession.create({
        data: { id, csrfToken, expiresAt, credentialVersion },
      }),
    ]);
  }

  async session(id: string) {
    return this.prisma.knowledgeAdminSession.findFirst({
      where: { id, expiresAt: { gt: new Date() } },
    });
  }

  async removeSession(id: string): Promise<void> {
    await this.prisma.knowledgeAdminSession.deleteMany({ where: { id } });
  }
}
