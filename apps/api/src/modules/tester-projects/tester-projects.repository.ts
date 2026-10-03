import { Inject, Injectable } from '@nestjs/common';
import type { TesterFeedbackInput, TesterProjectInput, TesterProjectsQuery } from '@repo/api-contracts';
import { Prisma, type TesterProfile, type TesterProjectApplication, type TesterProjectFeedback } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const projectIncludes = {
  applications: { select: { status: true } },
  feedback: { select: { rating: true } },
} satisfies Prisma.TesterProjectInclude;
export type StoredProject = Prisma.TesterProjectGetPayload<{ include: typeof projectIncludes }>;
export type StoredApplicant = TesterProjectApplication & { profile: TesterProfile };

export class TesterProjectsStore {
  constructor(protected readonly database: Prisma.TransactionClient) {}

  async listProjects(query: TesterProjectsQuery): Promise<{ projects: StoredProject[]; total: number }> {
    const where: Prisma.TesterProjectWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.query ? { OR: [
        { title: { contains: query.query, mode: 'insensitive' } },
        { description: { contains: query.query, mode: 'insensitive' } },
        { requirements: { contains: query.query, mode: 'insensitive' } },
        { organizerName: { contains: query.query, mode: 'insensitive' } },
        { location: { contains: query.query, mode: 'insensitive' } },
      ] } : {}),
    };
    const [projects, total] = await Promise.all([
      this.database.testerProject.findMany({ where, include: projectIncludes,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.database.testerProject.count({ where }),
    ]);
    return { projects, total };
  }

  project(id: string): Promise<StoredProject | null> {
    return this.database.testerProject.findUnique({ where: { id }, include: projectIncludes });
  }

  createProject(ownerId: string, input: TesterProjectInput): Promise<StoredProject> {
    return this.database.testerProject.create({ data: { ...input, ownerId }, include: projectIncludes });
  }

  updateProject(id: string, input: TesterProjectInput): Promise<StoredProject> {
    return this.database.testerProject.update({ where: { id }, data: input, include: projectIncludes });
  }

  ownProfile(ownerHash: string): Promise<TesterProfile | null> {
    return this.database.testerProfile.findUnique({ where: { ownerHash } });
  }

  application(projectId: string, accountId: string): Promise<TesterProjectApplication | null> {
    return this.database.testerProjectApplication.findUnique({ where: { projectId_accountId: { projectId, accountId } } });
  }

  applicationById(projectId: string, id: string): Promise<TesterProjectApplication | null> {
    return this.database.testerProjectApplication.findFirst({ where: { projectId, id } });
  }

  apply(projectId: string, accountId: string, profileId: string, message: string): Promise<TesterProjectApplication> {
    return this.database.testerProjectApplication.upsert({
      where: { projectId_accountId: { projectId, accountId } },
      create: { projectId, accountId, profileId, message },
      update: { message, status: 'pending', profileId },
    });
  }

  setApplicationStatus(id: string, status: 'accepted' | 'declined' | 'withdrawn'): Promise<TesterProjectApplication> {
    return this.database.testerProjectApplication.update({ where: { id }, data: { status } });
  }

  applicants(projectId: string): Promise<StoredApplicant[]> {
    return this.database.testerProjectApplication.findMany({
      where: { projectId }, include: { profile: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  feedback(projectId: string): Promise<TesterProjectFeedback[]> {
    return this.database.testerProjectFeedback.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  ownFeedback(projectId: string, accountId: string): Promise<TesterProjectFeedback | null> {
    return this.database.testerProjectFeedback.findUnique({ where: { projectId_accountId: { projectId, accountId } } });
  }

  saveFeedback(application: TesterProjectApplication, authorName: string, input: TesterFeedbackInput): Promise<TesterProjectFeedback> {
    return this.database.testerProjectFeedback.upsert({
      where: { projectId_accountId: { projectId: application.projectId, accountId: application.accountId } },
      create: { ...input, authorName, applicationId: application.id, projectId: application.projectId, accountId: application.accountId },
      update: { ...input, authorName },
    });
  }

  async activity(accountId: string): Promise<{
    projects: StoredProject[];
    applications: Array<TesterProjectApplication & { project: StoredProject }>;
    feedback: Array<TesterProjectFeedback & { project: StoredProject }>;
  }> {
    const [projects, applications, feedback] = await Promise.all([
      this.database.testerProject.findMany({ where: { ownerId: accountId }, include: projectIncludes, orderBy: { updatedAt: 'desc' } }),
      this.database.testerProjectApplication.findMany({ where: { accountId }, include: { project: { include: projectIncludes } }, orderBy: { updatedAt: 'desc' } }),
      this.database.testerProjectFeedback.findMany({ where: { accountId }, include: { project: { include: projectIncludes } }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { projects, applications, feedback };
  }
}

@Injectable()
export class TesterProjectsRepository extends TesterProjectsStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super(prisma);
  }

  withProjectLock<T>(id: string, work: (store: TesterProjectsStore) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`);
      return work(new TesterProjectsStore(transaction));
    });
  }
}
