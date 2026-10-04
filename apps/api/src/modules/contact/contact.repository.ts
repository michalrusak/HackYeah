import { Inject, Injectable } from '@nestjs/common';
import {
  EXPERT_CATEGORIES,
  type ContactCategory,
  type ContactStatus,
} from '@repo/api-contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  Conversation,
  Message,
  Prisma,
} from '../../generated/prisma/client.js';

const withExpert = { expert: { select: { expertName: true } } } as const;
const withMessages = {
  ...withExpert,
  messages: { orderBy: { createdAt: 'asc' } },
} as const;

export type ConversationRow = Conversation & {
  expert: { expertName: string | null } | null;
};
export type ThreadRow = ConversationRow & { messages: Message[] };

export interface ExpertScope {
  id: string;
  name: string;
  areas: string[];
}

/**
 * Ekspert widzi sprawy, które prowadzi, oraz wolne sprawy ze swoich dziedzin
 * (albo bez dziedziny) — nigdy własnych zgłoszeń.
 */
function expertScope(expert: ExpertScope): Prisma.ConversationWhereInput {
  return {
    category: { in: [...EXPERT_CATEGORIES] },
    accountId: { not: expert.id },
    OR: [
      { expertId: expert.id },
      { expertId: null, OR: [{ area: null }, { area: { in: expert.areas } }] },
    ],
  };
}

@Injectable()
export class ContactRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForAccount(accountId: string): Promise<ConversationRow[]> {
    return this.prisma.conversation.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
      include: withExpert,
    });
  }

  /** Skrzynka ROPS: najpierw sprawy czekające na odpowiedź, zamknięte na końcu. */
  async queue(): Promise<{ items: ConversationRow[]; attention: number }> {
    return this.queueOf({});
  }

  async expertQueue(
    expert: ExpertScope,
  ): Promise<{ items: ConversationRow[]; attention: number }> {
    return this.queueOf(expertScope(expert));
  }

  async find(id: string): Promise<ThreadRow | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: withMessages,
    });
  }

  async findForExpert(
    id: string,
    expert: ExpertScope,
  ): Promise<ThreadRow | null> {
    return this.prisma.conversation.findFirst({
      where: { id, ...expertScope(expert) },
      include: withMessages,
    });
  }

  async create(data: {
    accountId: string;
    firstName: string;
    lastName: string;
    organization: string | null;
    category: ContactCategory;
    area: string | null;
    subject: string;
    initialMessage: string;
  }): Promise<ThreadRow> {
    const { initialMessage, ...conversation } = data;
    return this.prisma.conversation.create({
      data: {
        ...conversation,
        messages: { create: { author: 'USER', content: initialMessage } },
      },
      include: withMessages,
    });
  }

  /**
   * Wiadomość i stan sprawy zapisują się razem albo wcale. Odpowiedź eksperta
   * od razu przypisuje mu sprawę.
   */
  async addMessage(
    id: string,
    author: 'USER' | 'ROPS' | 'EXPERT',
    content: string,
    expert?: ExpertScope,
  ): Promise<ThreadRow> {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        status: author === 'USER' ? 'AWAITING_ROPS' : 'ANSWERED',
        ...(expert ? { expertId: expert.id } : {}),
        messages: {
          create: { author, content, authorName: expert?.name ?? null },
        },
      },
      include: withMessages,
    });
  }

  /** Zwraca `false`, gdy sprawę zdążył przejąć ktoś inny. */
  async claim(id: string, expertId: string): Promise<boolean> {
    const { count } = await this.prisma.conversation.updateMany({
      where: { id, expertId: null },
      data: { expertId },
    });
    return count > 0;
  }

  async release(id: string): Promise<ThreadRow> {
    return this.prisma.conversation.update({
      where: { id },
      data: { expertId: null },
      include: withMessages,
    });
  }

  async setStatus(id: string, status: ContactStatus): Promise<ThreadRow> {
    return this.prisma.conversation.update({
      where: { id },
      data: { status },
      include: withMessages,
    });
  }

  private async queueOf(
    where: Prisma.ConversationWhereInput,
  ): Promise<{ items: ConversationRow[]; attention: number }> {
    const [items, attention] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 100,
        include: withExpert,
      }),
      this.prisma.conversation.count({
        where: { ...where, status: 'AWAITING_ROPS' },
      }),
    ]);
    return { items, attention };
  }
}
