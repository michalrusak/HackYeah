import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ExpertsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { expertName: { not: null } },
      orderBy: { expertName: 'asc' },
    });
  }

  async grant(login: string, name: string, areas: string[]): Promise<boolean> {
    const { count } = await this.prisma.account.updateMany({
      where: { login },
      data: { expertName: name, expertAreas: areas },
    });
    return count > 0;
  }

  /** Sprawy prowadzone przez byłego eksperta wracają do puli. */
  async revoke(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.conversation.updateMany({
        where: { expertId: id },
        data: { expertId: null },
      }),
      this.prisma.account.updateMany({
        where: { id },
        data: { expertName: null, expertAreas: [] },
      }),
    ]);
  }
}
