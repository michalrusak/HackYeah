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

  /** Wiadomość i zmiana stanu fiszki zapisują się razem albo wcale. */
  async addMessage(
    ideaId: string,
    author: 'AUTHOR' | 'ROPS',
    content: string,
    status?: IdeaStatus,
  ): Promise<IdeaRow> {
    return this.prisma.$transaction(async (tx) => {
      if (content)
        await tx.ideaMessage.create({ data: { ideaId, author, content } });
      return tx.idea.update({
        where: { id: ideaId },
        data: {
          awaitsRops: author === 'AUTHOR',
          ...(author === 'ROPS' ? { unreadReply: true } : {}),
          ...(status ? { status } : {}),
        },
        include: ideaInclude,
      });
    });
  }
}
