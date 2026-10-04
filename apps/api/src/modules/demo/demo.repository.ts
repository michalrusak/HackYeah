import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Account } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  demoApplicationMessage,
  demoConversation,
  demoIdea,
  demoProfile,
  demoProject,
} from './demo.data.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class DemoRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Hasło i rola konta demo wracają do wartości z konfiguracji przy każdym starcie. */
  saveAccount(
    login: string,
    passwordHash: string,
    expert: { expertName: string; expertAreas: string[] } | null,
  ): Promise<Account> {
    return this.prisma.account.upsert({
      where: { login },
      create: {
        login,
        passwordHash,
        ownerHash: sha256(`hackyeah:demo-account:v1:${login}`),
        ...expert,
      },
      update: { passwordHash, ...expert },
    });
  }

  /** Dodaje tylko brakujące wpisy — zmiany wprowadzone w trakcie demo zostają. */
  async ensureContent(tester: Account, organizer: Account): Promise<void> {
    const { id: projectId, ...project } = demoProject;
    const { initialMessage, ...conversation } = demoConversation;
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.testerProfile.upsert({
        where: { ownerHash: tester.ownerHash },
        create: { ...demoProfile, ownerHash: tester.ownerHash, isDemo: true },
        update: {},
      });
      await tx.testerProject.upsert({
        where: { id: projectId },
        create: { ...project, id: projectId, ownerId: organizer.id },
        update: {},
      });
      await tx.testerProjectApplication.upsert({
        where: {
          projectId_accountId: { projectId, accountId: tester.id },
        },
        create: {
          projectId,
          accountId: tester.id,
          profileId: profile.id,
          message: demoApplicationMessage,
        },
        update: {},
      });
      await tx.conversation.upsert({
        where: { id: conversation.id },
        create: {
          ...conversation,
          accountId: tester.id,
          messages: { create: { author: 'USER', content: initialMessage } },
        },
        update: {},
      });
      await tx.idea.upsert({
        where: { id: demoIdea.id },
        create: {
          ...demoIdea,
          audiences: [...demoIdea.audiences],
          areas: [...demoIdea.areas],
          needs: [...demoIdea.needs],
          status: 'SUBMITTED',
          awaitsRops: true,
          editTokenHash: sha256(randomBytes(32).toString('hex')),
        },
        update: {},
      });
    });
  }
}
