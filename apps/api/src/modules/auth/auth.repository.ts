import { Inject, Injectable } from '@nestjs/common';
import type { Account, Session } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByLogin(login: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { login } });
  }

  findByOwner(ownerHash: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { ownerHash } });
  }

  createAccount(data: {
    login: string;
    passwordHash: string;
    ownerHash: string;
  }): Promise<Account> {
    return this.prisma.account.create({ data });
  }

  async createSession(data: {
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { accountId: data.accountId, expiresAt: { lte: new Date() } },
      }),
      this.prisma.session.create({ data }),
    ]);
  }

  findSession(
    tokenHash: string,
  ): Promise<(Session & { account: Account }) | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }
}
