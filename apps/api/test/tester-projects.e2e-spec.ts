import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AuthSessionResponseSchema,
  TesterActivityResponseSchema,
  TesterApplicationsResponseSchema,
  TesterProjectDetailResponseSchema,
  TesterProjectsResponseSchema,
  type TesterProjectInput,
  type TesterProjectDetailData,
} from '@repo/api-contracts';
import request, { type Test as HttpTest } from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TestersModule } from '../src/modules/testers/testers.module.js';
import { TesterProjectsModule } from '../src/modules/tester-projects/tester-projects.module.js';
import { TesterProjectsRepository } from '../src/modules/tester-projects/tester-projects.repository.js';
import { connectTestersDatabase, createTestersDatabase } from './testers-db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const origin = 'http://localhost:4200';
const projectInput: TesterProjectInput = {
  organizerName: 'Fundacja Dobry Test',
  title: 'Test dostępnej mapy miasta',
  description:
    'Zapraszamy do sprawdzenia prototypu mapy dostępnych miejsc i przekazania swoich uwag.',
  requirements:
    'Osoby korzystające ze smartfona i zainteresowane dostępnością.',
  location: 'Kraków',
  mode: 'hybrid',
  stage: 'prototype',
  status: 'open',
};
const feedbackInput = {
  rating: 5,
  review: 'Mapa jest czytelna i pomaga zaplanować trasę.',
  improvement: 'Dodajcie większe etykiety przycisków.',
};
interface Actor {
  id: string;
  login: string;
  cookie: string;
}

function authenticated(call: HttpTest, actor: Actor): HttpTest {
  return call.set('Origin', origin).set('Cookie', actor.cookie);
}
function data(response: { body: unknown }): TesterProjectDetailData {
  return TesterProjectDetailResponseSchema.parse(response.body).data;
}

describe.skipIf(!databaseUrl)('Tester projects with PostgreSQL', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let repository: TesterProjectsRepository;
  let organizer: Actor;
  let participant: Actor;
  let secondParticipant: Actor;
  let stranger: Actor;

  async function account(displayName?: string): Promise<Actor> {
    const login = `project_${randomUUID().replaceAll('-', '').slice(0, 22)}`;
    const result = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login, password: 'Test-project-password-123!' })
      .expect(201);
    const user = AuthSessionResponseSchema.parse(result.body).data.user;
    const cookies = result.headers['set-cookie'];
    if (!user || !Array.isArray(cookies) || typeof cookies[0] !== 'string')
      throw new Error('Expected authenticated account');
    const cookie = cookies[0].split(';')[0];
    if (!cookie) throw new Error('Expected session cookie');
    const actor = { id: user.id, login, cookie };
    if (displayName) {
      await authenticated(
        request(app.getHttpServer()).put('/api/testers/profile/me'),
        actor,
      )
        .send({
          displayName,
          city: 'Kraków',
          bio: 'Lubię testować dostępne rozwiązania i przekazywać konstruktywne opinie.',
          skills: ['Testy aplikacji'],
          resources: ['Smartfon'],
          interests: ['Dostępność'],
          accessibilityNeeds: '',
          availability: 'remote',
        })
        .expect(200);
    }
    return actor;
  }

  async function create(
    changes: Partial<TesterProjectInput> = {},
  ): Promise<TesterProjectDetailData> {
    return data(
      await authenticated(
        request(app.getHttpServer()).post('/api/testers/projects'),
        organizer,
      )
        .send({ ...projectInput, ...changes })
        .expect(201),
    );
  }

  async function apply(
    id: string,
    actor = participant,
  ): Promise<TesterProjectDetailData> {
    return data(
      await authenticated(
        request(app.getHttpServer()).put(
          `/api/testers/projects/${id}/applications/me`,
        ),
        actor,
      )
        .send({
          message: 'Mam smartfon i mogę poświęcić dwie godziny na testy.',
        })
        .expect(200),
    );
  }

  async function accept(id: string, actor = participant): Promise<string> {
    const application = (await apply(id, actor)).myApplication;
    if (!application) throw new Error('Expected an application');
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${application.id}`,
      ),
      organizer,
    )
      .send({ status: 'accepted' })
      .expect(200);
    return application.id;
  }

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
    database = connectTestersDatabase(
      databaseUrl,
      await createTestersDatabase(databaseUrl),
    );
    await database.$connect();
    const module = await Test.createTestingModule({
      imports: [TestersModule, TesterProjectsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({}))
      .compile();
    repository = module.get(TesterProjectsRepository);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    organizer = await account();
    participant = await account('Anna Testerka');
    secondParticipant = await account('Jan Tester');
    stranger = await account();
  });

  afterAll(async () => {
    await database?.testerProjectFeedback.deleteMany();
    await database?.testerProjectApplication.deleteMany();
    await database?.testerProject.deleteMany();
    await database?.testerProfile.deleteMany();
    await database?.session.deleteMany();
    await database?.account.deleteMany();
    await app?.close();
    await database?.$disconnect();
  });

  it('publishes public details and filters without exposing accounts or private participation', async () => {
    const created = await create({
      title: 'Mapa UnikalnaTestowa123',
      stage: 'solution',
    });
    expect(created.project.isOwner).toBe(true);
    const response = await request(app.getHttpServer())
      .get(`/api/testers/projects/${created.project.id}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(data(response)).toMatchObject({
      project: { isOwner: false, organizerName: projectInput.organizerName },
      myApplication: null,
      myFeedback: null,
      feedback: [],
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(organizer.login);
    expect(serialized).not.toContain(organizer.id);
    expect(serialized).not.toMatch(/ownerHash|ownerId|password|accountId/);
    const list = await request(app.getHttpServer())
      .get('/api/testers/projects')
      .query({
        query: 'UnikalnaTestowa123',
        stage: 'solution',
        mode: 'hybrid',
        pageSize: 1,
      })
      .expect(200);
    expect(TesterProjectsResponseSchema.parse(list.body).data).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 1,
      projects: [expect.objectContaining({ id: created.project.id })],
    });
  });

  it('requires an account, trusted origin and valid project fields for publishing', async () => {
    await request(app.getHttpServer())
      .post('/api/testers/projects')
      .send(projectInput)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/testers/projects')
      .set('X-Tester-Key', 'a'.repeat(64))
      .send(projectInput)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/testers/projects')
      .set('Cookie', organizer.cookie)
      .set('Origin', 'https://evil.invalid')
      .send(projectInput)
      .expect(403);
    for (const changes of [
      { title: 'x' },
      { organizerName: '' },
      { mode: 'invalid' },
      { ownerId: stranger.id },
    ]) {
      await authenticated(
        request(app.getHttpServer()).post('/api/testers/projects'),
        organizer,
      )
        .send({ ...projectInput, ...changes })
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/api/testers/projects')
      .query({ pageSize: 1000 })
      .expect(400);
  });

  it('only lets the organizer edit and close recruitment; requires a profile to apply', async () => {
    const id = (await create()).project.id;
    await authenticated(
      request(app.getHttpServer()).put(`/api/testers/projects/${id}`),
      stranger,
    )
      .send(projectInput)
      .expect(404);
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/applications/me`,
      ),
      organizer,
    )
      .send({})
      .expect(403);
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/applications/me`,
      ),
      stranger,
    )
      .send({})
      .expect(409);
    const closed = await authenticated(
      request(app.getHttpServer()).put(`/api/testers/projects/${id}`),
      organizer,
    )
      .send({ ...projectInput, status: 'closed' })
      .expect(200);
    expect(data(closed).project.status).toBe('closed');
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/applications/me`,
      ),
      participant,
    )
      .send({})
      .expect(409);
    await authenticated(
      request(app.getHttpServer()).put(`/api/testers/projects/${id}`),
      organizer,
    )
      .send(projectInput)
      .expect(200);
    expect((await apply(id)).myApplication?.status).toBe('pending');
  });

  it('keeps one application per account under concurrent submissions and case-variant UUIDs', async () => {
    const id = (await create()).project.id;
    const results = await Promise.all(
      [id, id.toUpperCase()].map((projectId) =>
        authenticated(
          request(app.getHttpServer()).put(
            `/api/testers/projects/${projectId}/applications/me`,
          ),
          participant,
        ).send({ message: 'Zgłaszam się do testu.' }),
      ),
    );
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(data(results[0]).myApplication?.id).toBe(
      data(results[1]).myApplication?.id,
    );
    expect(
      await database.testerProjectApplication.count({
        where: { projectId: id, accountId: participant.id },
      }),
    ).toBe(1);
  });

  it('keeps applicant rosters and messages private to the owner and participant', async () => {
    const id = (await create()).project.id;
    const own = await apply(id);
    await request(app.getHttpServer())
      .get(`/api/testers/projects/${id}/applications`)
      .expect(401);
    await authenticated(
      request(app.getHttpServer()).get(
        `/api/testers/projects/${id}/applications`,
      ),
      participant,
    ).expect(404);
    const roster = await authenticated(
      request(app.getHttpServer()).get(
        `/api/testers/projects/${id}/applications`,
      ),
      organizer,
    ).expect(200);
    expect(
      TesterApplicationsResponseSchema.parse(roster.body).data.applications,
    ).toHaveLength(1);
    expect(JSON.stringify(roster.body)).not.toContain(participant.login);
    const publicDetail = data(
      await request(app.getHttpServer())
        .get(`/api/testers/projects/${id}`)
        .expect(200),
    );
    expect(publicDetail.myApplication).toBeNull();
    expect(publicDetail.project.applicationCount).toBe(1);
    expect(JSON.stringify(publicDetail)).not.toContain(
      own.myApplication?.message,
    );
  });

  it('restricts acceptance and rejection to pending applications of the owner project', async () => {
    const id = (await create()).project.id;
    const application = (await apply(id)).myApplication;
    if (!application) throw new Error('Missing application');
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${application.id}`,
      ),
      stranger,
    )
      .send({ status: 'accepted' })
      .expect(404);
    const unrelatedId = (await create()).project.id;
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${unrelatedId}/applications/${application.id}`,
      ),
      organizer,
    )
      .send({ status: 'accepted' })
      .expect(404);
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${application.id}`,
      ),
      organizer,
    )
      .send({ status: 'declined' })
      .expect(200);
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${application.id}`,
      ),
      organizer,
    )
      .send({ status: 'accepted' })
      .expect(409);
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/feedback/me`,
      ),
      participant,
    )
      .send(feedbackInput)
      .expect(403);
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/applications/me`,
      ),
      participant,
    )
      .send({})
      .expect(409);
  });

  it('supports withdrawal and reapplication but never accepts a withdrawn application', async () => {
    const id = (await create()).project.id;
    const application = (await apply(id)).myApplication;
    if (!application) throw new Error('Missing application');
    await authenticated(
      request(app.getHttpServer()).delete(
        `/api/testers/projects/${id}/applications/me`,
      ),
      stranger,
    ).expect(404);
    const withdrawn = await authenticated(
      request(app.getHttpServer()).delete(
        `/api/testers/projects/${id}/applications/me`,
      ),
      participant,
    ).expect(200);
    expect(data(withdrawn).myApplication?.status).toBe('withdrawn');
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${application.id}`,
      ),
      organizer,
    )
      .send({ status: 'accepted' })
      .expect(409);
    const reapplied = await apply(id);
    expect(reapplied.myApplication).toMatchObject({
      id: application.id,
      status: 'pending',
    });
  });

  it('allows accepted participants to edit one review after closure and calculates unweighted duplicate-free averages', async () => {
    const id = (await create()).project.id;
    const applicationId = await accept(id);
    await accept(id, secondParticipant);
    await authenticated(
      request(app.getHttpServer()).put(`/api/testers/projects/${id}`),
      organizer,
    )
      .send({ ...projectInput, status: 'closed' })
      .expect(200);
    const first = data(
      await authenticated(
        request(app.getHttpServer()).put(
          `/api/testers/projects/${id}/feedback/me`,
        ),
        participant,
      )
        .send(feedbackInput)
        .expect(200),
    );
    const changed = data(
      await authenticated(
        request(app.getHttpServer()).put(
          `/api/testers/projects/${id}/feedback/me`,
        ),
        participant,
      )
        .send({ ...feedbackInput, rating: 2 })
        .expect(200),
    );
    expect(changed.myFeedback?.id).toBe(first.myFeedback?.id);
    expect(changed.project).toMatchObject({
      feedbackCount: 1,
      averageRating: 2,
    });
    const second = data(
      await authenticated(
        request(app.getHttpServer()).put(
          `/api/testers/projects/${id}/feedback/me`,
        ),
        secondParticipant,
      )
        .send({ ...feedbackInput, rating: 4 })
        .expect(200),
    );
    expect(second.project).toMatchObject({
      feedbackCount: 2,
      averageRating: 3,
    });
    expect(
      await database.testerProjectFeedback.count({ where: { projectId: id } }),
    ).toBe(2);
    await authenticated(
      request(app.getHttpServer()).delete(
        `/api/testers/projects/${id}/applications/me`,
      ),
      participant,
    ).expect(409);
    await authenticated(
      request(app.getHttpServer()).patch(
        `/api/testers/projects/${id}/applications/${applicationId}`,
      ),
      organizer,
    )
      .send({ status: 'declined' })
      .expect(409);
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/feedback/me`,
      ),
      organizer,
    )
      .send(feedbackInput)
      .expect(403);
    const publicDetail = data(
      await request(app.getHttpServer())
        .get(`/api/testers/projects/${id}`)
        .expect(200),
    );
    expect(
      publicDetail.feedback.map((feedback) => feedback.authorName).sort(),
    ).toEqual(['Anna Testerka', 'Jan Tester']);
    expect(publicDetail.myFeedback).toBeNull();
    expect(JSON.stringify(publicDetail)).not.toContain(participant.login);
  });

  it('validates ratings and rejects identity spoofing in feedback bodies', async () => {
    const id = (await create()).project.id;
    await accept(id);
    for (const changes of [
      { rating: 0 },
      { rating: 6 },
      { rating: 1.5 },
      { review: 'krótko' },
      { accountId: stranger.id },
    ]) {
      await authenticated(
        request(app.getHttpServer()).put(
          `/api/testers/projects/${id}/feedback/me`,
        ),
        participant,
      )
        .send({ ...feedbackInput, ...changes })
        .expect(400);
    }
    await authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id}/feedback/me`,
      ),
      stranger,
    )
      .send(feedbackInput)
      .expect(403);
    expect(
      await database.testerProjectFeedback.count({ where: { projectId: id } }),
    ).toBe(0);
  });

  it('returns only each account own projects, applications and feedback in activity', async () => {
    await request(app.getHttpServer()).get('/api/testers/activity').expect(401);
    const own = await authenticated(
      request(app.getHttpServer()).get('/api/testers/activity'),
      participant,
    ).expect(200);
    const activity = TesterActivityResponseSchema.parse(own.body).data;
    expect(activity.projects).toEqual([]);
    expect(activity.applications.length).toBeGreaterThan(0);
    expect(activity.feedback).toHaveLength(1);
    const empty = await authenticated(
      request(app.getHttpServer()).get('/api/testers/activity'),
      stranger,
    ).expect(200);
    expect(TesterActivityResponseSchema.parse(empty.body).data).toEqual({
      projects: [],
      applications: [],
      feedback: [],
    });
    const owner = await authenticated(
      request(app.getHttpServer()).get('/api/testers/activity'),
      organizer,
    ).expect(200);
    expect(
      TesterActivityResponseSchema.parse(owner.body).data.applications,
    ).toEqual([]);
  });

  it('serializes an application behind a concurrent recruitment closure in an isolated database schema', async () => {
    const id = (await create()).project.id;
    let releaseLock: () => void = () => {};
    let announceLock: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const closing = repository.withProjectLock(id, async (store) => {
      await store.updateProject(id, { ...projectInput, status: 'closed' });
      announceLock();
      await release;
    });
    await held;
    let completed = false;
    const joining = authenticated(
      request(app.getHttpServer()).put(
        `/api/testers/projects/${id.toUpperCase()}/applications/me`,
      ),
      participant,
    )
      .send({})
      .then((result) => {
        completed = true;
        return result;
      });
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(completed).toBe(false);
    } finally {
      releaseLock();
    }
    await closing;
    expect((await joining).status).toBe(409);
    expect(
      await database.testerProjectApplication.count({
        where: { projectId: id },
      }),
    ).toBe(0);
  });
});
