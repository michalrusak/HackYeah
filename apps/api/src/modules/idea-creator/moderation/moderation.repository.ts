import { Inject, Injectable } from '@nestjs/common';
import type { IdeaStatus } from '@repo/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IdeaRow } from '../ideas/idea.mapper.js';

const ideaInclude = {
  visuals: { orderBy: { createdAt: 'desc' }, take: 1 },
  canvas: { select: { id: true } },
} as const;

export interface MessageRow {
  id: string;
  author: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
}

@Injectable()
export class ModerationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Kolejka ROPS: wszystko poza szkicami, najpierw pomysły czekające na reakcję. */
  async queue(): Promise<{ items: IdeaRow[]; attention: number }> {
    const [items, attention] = await this.prisma.$transaction([
      this.prisma.idea.findMany({
        where: { status: { not: 'DRAFT' } },
        include: ideaInclude,
        orderBy: [{ awaitsRops: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
      }),
      this.prisma.idea.count({ where: { awaitsRops: true } }),
    ]);
    return { items, attention };
  }

  /**
   * Pomysły dla eksperta: zgłoszone lub opublikowane, z jego dziedzin albo
   * jeszcze bez dziedziny. `opinions` liczy dotychczasowe opinie ekspertów.
   */
  async expertQueue(
    areas: string[],
  ): Promise<{ row: IdeaRow; opinions: number }[]> {
    const rows = await this.prisma.idea.findMany({
      where: {
        status: { in: ['SUBMITTED', 'NEEDS_CHANGES', 'PUBLISHED'] },
        OR: [{ areas: { isEmpty: true } }, { areas: { hasSome: areas } }],
      },
      include: {
        ...ideaInclude,
        _count: { select: { thread: { where: { author: 'EXPERT' } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({ row, opinions: row._count.thread }));
  }

  async messages(ideaId: string): Promise<MessageRow[]> {
    return this.prisma.ideaMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markRead(ideaId: string): Promise<void> {
    await this.prisma.idea.updateMany({
      where: { id: ideaId, unreadReply: true },
      data: { unreadReply: false },
    });
  }

  /**
   * Wiadomość i zmiana stanu fiszki zapisują się razem albo wcale. Opinia
   * eksperta nie zdejmuje pomysłu z kolejki ROPS.
   */
  async addMessage(
    ideaId: string,
    author: 'AUTHOR' | 'ROPS' | 'EXPERT',
    content: string,
    status?: IdeaStatus,
    authorName?: string,
  ): Promise<IdeaRow> {
    return this.prisma.$transaction(async (tx) => {
      if (content)
        await tx.ideaMessage.create({
          data: { ideaId, author, content, authorName: authorName ?? null },
        });
      return tx.idea.update({
        where: { id: ideaId },
        data: {
          ...(author === 'EXPERT' ? {} : { awaitsRops: author === 'AUTHOR' }),
          ...(author === 'AUTHOR' ? {} : { unreadReply: true }),
          ...(status ? { status } : {}),
        },
        include: ideaInclude,
      });
    });
  }
}
