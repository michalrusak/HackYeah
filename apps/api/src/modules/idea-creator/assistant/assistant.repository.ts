import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

export interface AssistantMessageRow {
  role: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class AssistantRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findHistory(
    ideaId: string,
    take = 20,
  ): Promise<AssistantMessageRow[]> {
    const rows = await this.prisma.assistantMessage.findMany({
      where: { ideaId, kind: 'CHAT' },
      orderBy: { createdAt: 'desc' },
      take,
      select: { role: true, content: true, createdAt: true },
    });
    return rows.reverse();
  }

  async append(
    ideaId: string,
    entries: { role: 'USER' | 'ASSISTANT'; content: string }[],
  ): Promise<void> {
    await this.prisma.assistantMessage.createMany({
      data: entries.map((entry) => ({ ideaId, kind: 'CHAT' as const, ...entry })),
    });
  }
}
