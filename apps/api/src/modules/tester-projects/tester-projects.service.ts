import { activePilotConditions } from '../matchmaking/pilot-eligibility.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  createApiSuccess,
  ErrorCodes,
  type ErrorCode,
  type TesterActivityData,
  type TesterApplicationInput,
  type TesterApplicationStatusInput,
  type TesterApplicationsData,
  type TesterFeedbackInput,
  type TesterProjectDetailData,
  type TesterProjectInput,
  type TesterProjectsData,
  type TesterProjectsQuery,
} from '@repo/api-contracts';
import {
  toTesterProfile,
  type TesterOutcome,
} from '../testers/testers.service.js';
import {
  toApplication,
  toFeedback,
  toProject,
} from './tester-projects.mapper.js';
import {
  TesterProjectsRepository,
  TesterProjectsStore,
  type StoredProject,
} from './tester-projects.repository.js';

export interface TesterAccountIdentity {
  id: string;
  ownerHash: string;
}

function failure<T>(
  status: number,
  code: ErrorCode,
  message: string,
): TesterOutcome<T> {
  return { status, body: { success: false, error: { code, message } } };
}
function missing<T>(): TesterOutcome<T> {
  return failure(
    404,
    ErrorCodes.NOT_FOUND,
    'Nie znaleziono ogłoszenia lub zgłoszenia.',
  );
}
function conflict<T>(message: string): TesterOutcome<T> {
  return failure(409, ErrorCodes.CONFLICT, message);
}
function forbidden<T>(message: string): TesterOutcome<T> {
  return failure(403, ErrorCodes.FORBIDDEN, message);
}

@Injectable()
export class TesterProjectsService {
  constructor(
    @Inject(TesterProjectsRepository)
    private readonly repository: TesterProjectsRepository,
  ) {}

  async list(
    query: TesterProjectsQuery,
    account: TesterAccountIdentity | null,
  ): Promise<TesterOutcome<TesterProjectsData>> {
    const result = await this.repository.listProjects(query);
    return {
      status: 200,
      body: createApiSuccess({
        projects: result.projects.map((project) =>
          toProject(project, account?.id),
        ),
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
      }),
    };
  }

  async detail(
    id: string,
    account: TesterAccountIdentity | null,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    const project = await this.repository.project(id);
    return project
      ? this.details(this.repository, project, account)
      : missing();
  }

  async create(
    input: TesterProjectInput,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    const project = await this.repository.createProject(account.id, input);
    const result = await this.details(this.repository, project, account);
    return { ...result, status: 201 };
  }

  update(
    id: string,
    input: TesterProjectInput,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    return this.repository.withProjectLock(id, async (store) => {
      const project = await store.project(id);
      if (!project || project.ownerId !== account.id) return missing();
      return this.details(store, await store.updateProject(id, input), account);
    });
  }

  async applicants(
    id: string,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterApplicationsData>> {
    const project = await this.repository.project(id);
    if (!project || project.ownerId !== account.id) return missing();
    const applications = await this.repository.applicants(id);
    return {
      status: 200,
      body: createApiSuccess({
        applications: applications.map((application) => ({
          application: toApplication(application),
          profile: toTesterProfile(application.profile),
        })),
      }),
    };
  }

  apply(
    id: string,
    input: TesterApplicationInput,
    account: TesterAccountIdentity,
    pilotOnly = false,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    return this.repository.withProjectLock(id, async (store) => {
      const project = await store.project(id);
      if (!project) return missing();
      if (project.ownerId === account.id)
        return forbidden('Organizator nie może zgłosić się do własnego testu.');
      if (project.status !== 'open')
        return conflict('Nabór do tego testu jest zamknięty.');
      if (
        pilotOnly &&
        !activePilotConditions(project, await store.pilotListing(id))
      )
        return conflict(
          'Ten projekt nie jest już dostępny do testowania w matchmakingu.',
        );
      const profile = await store.ownProfile(account.ownerHash);
      if (!profile)
        return conflict(
          'Uzupełnij profil testera przed zgłoszeniem do testów.',
        );
      const current = await store.application(id, account.id);
      if (pilotOnly && current && current.status !== 'withdrawn')
        return this.details(store, project, account);
      if (current && !['pending', 'withdrawn'].includes(current.status))
        return conflict('Organizator podjął już decyzję o tym zgłoszeniu.');
      await store.apply(id, account.id, profile.id, input.message);
      return this.details(store, await store.project(id), account);
    });
  }

  withdraw(
    id: string,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    return this.repository.withProjectLock(id, async (store) => {
      const project = await store.project(id);
      const application = await store.application(id, account.id);
      if (!project || !application) return missing();
      if (application.status === 'declined')
        return conflict('To zgłoszenie zostało już odrzucone.');
      if (await store.ownFeedback(id, account.id))
        return conflict(
          'Zgłoszenie z opublikowaną opinią pozostaje w historii testu.',
        );
      await store.setApplicationStatus(application.id, 'withdrawn');
      return this.details(store, await store.project(id), account);
    });
  }

  decide(
    id: string,
    applicationId: string,
    input: TesterApplicationStatusInput,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    return this.repository.withProjectLock(id, async (store) => {
      const project = await store.project(id);
      if (!project || project.ownerId !== account.id) return missing();
      const application = await store.applicationById(id, applicationId);
      if (!application) return missing();
      if (application.status !== 'pending')
        return conflict('Możesz zdecydować tylko o oczekującym zgłoszeniu.');
      await store.setApplicationStatus(application.id, input.status);
      return this.details(store, await store.project(id), account);
    });
  }

  feedback(
    id: string,
    input: TesterFeedbackInput,
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    return this.repository.withProjectLock(id, async (store) => {
      const project = await store.project(id);
      if (!project) return missing();
      const application = await store.application(id, account.id);
      if (!application || application.status !== 'accepted')
        return forbidden('Opinię może dodać zaakceptowany uczestnik testu.');
      const profile = await store.ownProfile(account.ownerHash);
      if (!profile)
        return forbidden('Do dodania opinii potrzebny jest profil testera.');
      await store.saveFeedback(application, profile.displayName, input);
      return this.details(store, await store.project(id), account);
    });
  }

  async activity(
    account: TesterAccountIdentity,
  ): Promise<TesterOutcome<TesterActivityData>> {
    const result = await this.repository.activity(account.id);
    return {
      status: 200,
      body: createApiSuccess({
        projects: result.projects.map((project) =>
          toProject(project, account.id),
        ),
        applications: result.applications.map((application) => ({
          project: toProject(application.project, account.id),
          application: toApplication(application),
        })),
        feedback: result.feedback.map((feedback) => ({
          project: toProject(feedback.project, account.id),
          feedback: toFeedback(feedback),
        })),
      }),
    };
  }

  private async details(
    store: TesterProjectsStore,
    project: StoredProject | null,
    account: TesterAccountIdentity | null,
  ): Promise<TesterOutcome<TesterProjectDetailData>> {
    if (!project) return missing();
    const [feedback, application] = await Promise.all([
      store.feedback(project.id),
      account ? store.application(project.id, account.id) : null,
    ]);
    const ownFeedback = feedback.find((item) => item.accountId === account?.id);
    return {
      status: 200,
      body: createApiSuccess({
        project: toProject(project, account?.id),
        myApplication: application ? toApplication(application) : null,
        myFeedback: ownFeedback ? toFeedback(ownFeedback) : null,
        feedback: feedback.map(toFeedback),
      }),
    };
  }
}
