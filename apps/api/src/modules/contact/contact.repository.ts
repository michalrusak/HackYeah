import { Inject, Injectable } from '@nestjs/common';
import type { ContactCategory, ContactStatus } from '@repo/api-contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Conversation, Message } from '../../generated/prisma/client.js';

const withMessages = {
  messages: { orderBy: { createdAt: 'asc' } },
} as const;

export type ThreadRow = Conversation & { messages: Message[] };

@Injectable()
export class ContactRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForAccount(accountId: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Skrzynka ROPS: najpierw sprawy czekające na odpowiedź, zamknięte na końcu. */
  async queue(): Promise<{ items: Conversation[]; attention: number }> {
    const [items, attention] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 100,
      }),
      this.prisma.conversation.count({ where: { status: 'AWAITING_ROPS' } }),
    ]);
    return { items, attention };
  }

  async find(id: string): Promise<ThreadRow | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: withMessages,
    });
  }

  async create(data: {
    accountId: string;
    firstName: string;
    lastName: string;
    organization: string | null;
    category: ContactCategory;
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

  /** Wiadomość i stan sprawy zapisują się razem albo wcale. */
  async addMessage(
    id: string,
    author: 'USER' | 'ROPS',
    content: string,
  ): Promise<ThreadRow> {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        status: author === 'USER' ? 'AWAITING_ROPS' : 'ANSWERED',
        messages: { create: { author, content } },
      },
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
}
