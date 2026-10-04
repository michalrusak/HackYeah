import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import {
  AdminSessionSchema,
  AuthSessionDataSchema,
  ContactThreadDataSchema,
  CreatedIdeaDataSchema,
  ExpertIdeaDetailDataSchema,
  ExpertIdeaListDataSchema,
  ExpertListDataSchema,
  ExpertQueueDataSchema,
  ExpertThreadDataSchema,
  IdeaDataSchema,
  IdeaThreadDataSchema,
  ModerationDetailDataSchema,
} from '@repo/api-contracts';
import { randomBytes, scryptSync } from 'node:crypto';
import request from 'supertest';
import { ContactModule } from '../src/modules/contact/contact.module.js';
import { ExpertsModule } from '../src/modules/experts/experts.module.js';
import { IdeaCreatorModule } from '../src/modules/idea-creator/idea-creator.module.js';
import { KnowledgeModule } from '../src/modules/knowledge/knowledge.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DomainExceptionFilter } from '../src/shared/filters/domain-exception.filter.js';
import { MailService } from '../src/shared/mail/mail.service.js';

const databaseUrl = process.env.KNOWLEDGE_TEST_DATABASE_URL;
const password = 'Synthetic test password only';
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const origin = 'http://localhost:4200';
const question = {
  firstName: 'Anna',
  lastName: 'Testowa',
  category: 'MENTOR',
  area: 'Seniorzy',
  subject: 'Fikcyjna prośba o mentora',
  initialMessage: 'Fikcyjna wiadomość wyłącznie do testów.',
};
const idea = {
  title: 'Sąsiedzka wypożyczalnia',
  essence: 'Fikcyjny pomysł wyłącznie do testów opinii eksperta.',
  problem: 'Fikcyjny problem opisany na potrzeby testu.',
  targetAudience: 'Seniorzy',
  stage: 'POMYSL',
  contactEmail: 'autor@example.com',
  areas: ['Seniorzy'],
};

describe.skipIf(!databaseUrl)('Experts with isolated PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: { to: string | null | undefined; subject: string }[] = [];

  beforeAll(async () => {
    const url = new URL(databaseUrl ?? '');
    if (
      url.pathname !== '/hackyeah_knowledge_test' ||
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw new Error(
        'Use only the isolated local hackyeah_knowledge_test database.',
      );
    process.env.WEB_ORIGIN = origin;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: databaseUrl,
              KNOWLEDGE_ADMIN_PASSWORD_HASH: passwordHash,
              WEB_ORIGIN: origin,
            }),
          ],
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        KnowledgeModule,
        ContactModule,
        IdeaCreatorModule,
        ExpertsModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({
        ideaUrl: (id: string) => `${origin}/pomysly/${id}`,
        send: (to: string | null | undefined, subject: string) => {
          sent.push({ to, subject });
        },
        notifyRops: () => undefined,
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    sent.length = 0;
    await prisma.idea.deleteMany();
    await prisma.account.deleteMany({
      where: { login: { startsWith: 'expert-e2e-' } },
    });
  });
  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  function cookieOf(response: request.Response): string {
    const raw = response.headers['set-cookie'];
    return (Array.isArray(raw) ? raw[0] : String(raw)).split(';')[0];
  }
  async function account(name: string) {
    const login = `expert-e2e-${name}`;
    const response = await http()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login, password: 'Synthetic-pass-123' })
      .expect(201);
    return { login, cookie: cookieOf(response) };
  }
  async function admin() {
    const response = await http()
      .post('/api/knowledge/admin/login')
      .set('Origin', origin)
      .send({ password })
      .expect(200);
    const session = AdminSessionSchema.parse(response.body.data);
    const cookie = cookieOf(response);
    return (path: string, body: object) =>
      http()
        .post(`/api/knowledge/admin/${path}`)
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-Knowledge-CSRF', session.csrfToken)
        .send(body);
  }
  const as = (cookie: string) => ({
    get: (path: string) => http().get(`/api/${path}`).set('Cookie', cookie),
    post: (path: string, body: object = {}) =>
      http()
        .post(`/api/${path}`)
        .set('Cookie', cookie)
        .set('Origin', origin)
        .send(body),
  });

  it('lets only ROPS grant and revoke the expert role', async () => {
    const person = await account('role');
    await as(person.cookie).get('experts/conversations').expect(403);
    await http().get('/api/experts/conversations').expect(401);
    const grant = { login: person.login, name: 'Jan Ekspert' };
    await as(person.cookie)
      .post('knowledge/admin/experts', { ...grant, areas: ['Seniorzy'] })
      .expect(401);

    const rops = await admin();
    await rops('experts', { ...grant, areas: [] }).expect(400);
    await rops('experts', {
      login: 'expert-e2e-missing',
      name: 'Nikt',
      areas: ['Seniorzy'],
    }).expect(404);
    const granted = ExpertListDataSchema.parse(
      (await rops('experts', { ...grant, areas: ['Seniorzy'] }).expect(200))
        .body.data,
    );
    const expert = granted.experts.find((item) => item.login === person.login);
    expect(expert).toMatchObject({ name: 'Jan Ekspert', areas: ['Seniorzy'] });

    const me = AuthSessionDataSchema.parse(
      (await as(person.cookie).get('auth/me').expect(200)).body.data,
    );
    expect(me.user?.expert).toEqual({
      name: 'Jan Ekspert',
      areas: ['Seniorzy'],
    });
    await as(person.cookie).get('experts/conversations').expect(200);

    await rops(`experts/${expert?.id}/revoke`, {}).expect(200);
    await as(person.cookie).get('experts/conversations').expect(403);
  });

  it('routes mentor requests to experts of the matching area and shows the answer to the user', async () => {
    const user = await account('user');
    const seniors = await account('seniors');
    const health = await account('health');
    const rops = await admin();
    await rops('experts', {
      login: seniors.login,
      name: 'Maria Senioralna',
      areas: ['Seniorzy'],
    }).expect(200);
    await rops('experts', {
      login: health.login,
      name: 'Piotr Zdrowotny',
      areas: ['Zdrowie'],
    }).expect(200);

    const create = (body: object) =>
      as(user.cookie).post('contact/conversations', body).expect(201);
    const id = ContactThreadDataSchema.parse((await create(question)).body.data)
      .conversation.id;
    // Zwykłe pytanie zostaje u ROPS, nawet gdy ma dziedzinę eksperta.
    await create({ ...question, category: 'QUESTION' });
    // Własne zgłoszenie eksperta nie trafia do jego skrzynki.
    await as(seniors.cookie)
      .post('contact/conversations', question)
      .expect(201);

    const queue = ExpertQueueDataSchema.parse(
      (await as(seniors.cookie).get('experts/conversations').expect(200)).body
        .data,
    );
    expect(queue.attention).toBe(1);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ id, mine: false, area: 'Seniorzy' });
    const other = ExpertQueueDataSchema.parse(
      (await as(health.cookie).get('experts/conversations').expect(200)).body
        .data,
    );
    expect(other.items.map((item) => item.id)).not.toContain(id);
    await as(health.cookie).get(`experts/conversations/${id}`).expect(404);
    await as(health.cookie)
      .post(`experts/conversations/${id}/messages`, { content: 'Nie moje' })
      .expect(404);

    const taken = ExpertThreadDataSchema.parse(
      (
        await as(seniors.cookie)
          .post(`experts/conversations/${id}/take`)
          .expect(200)
      ).body.data,
    );
    expect(taken.conversation).toMatchObject({
      mine: true,
      expertName: 'Maria Senioralna',
    });
    await as(seniors.cookie)
      .post(`experts/conversations/${id}/messages`, { content: 'Pomogę.' })
      .expect(200);

    const thread = ContactThreadDataSchema.parse(
      (await as(user.cookie).get(`contact/conversations/${id}`).expect(200))
        .body.data,
    );
    expect(thread.conversation).toMatchObject({
      status: 'ANSWERED',
      expertName: 'Maria Senioralna',
    });
    expect(
      thread.messages.map((item) => [item.author, item.authorName]),
    ).toEqual([
      ['USER', null],
      ['EXPERT', 'Maria Senioralna'],
    ]);

    await as(health.cookie)
      .post(`experts/conversations/${id}/release`)
      .expect(404);
    const released = ExpertThreadDataSchema.parse(
      (
        await as(seniors.cookie)
          .post(`experts/conversations/${id}/release`)
          .expect(200)
      ).body.data,
    );
    expect(released.conversation).toMatchObject({
      mine: false,
      expertName: null,
    });
  });

  it('adds an expert opinion to the idea thread without taking it off the ROPS queue', async () => {
    const seniors = await account('opinion');
    const health = await account('outside');
    const rops = await admin();
    await rops('experts', {
      login: seniors.login,
      name: 'Maria Senioralna',
      areas: ['Seniorzy'],
    }).expect(200);
    await rops('experts', {
      login: health.login,
      name: 'Piotr Zdrowotny',
      areas: ['Zdrowie'],
    }).expect(200);

    const created = CreatedIdeaDataSchema.parse(
      (await http().post('/api/ideas').send(idea).expect(201)).body.data,
    );
    const id = created.idea.id;
    const author = (path: string) =>
      http()
        .get(`/api/ideas/${id}${path}`)
        .set('X-Edit-Token', created.editToken);
    // Szkic jest prywatny także dla eksperta.
    await as(seniors.cookie).get(`experts/ideas/${id}`).expect(404);
    await http()
      .post(`/api/ideas/${id}/publish`)
      .set('X-Edit-Token', created.editToken)
      .expect(200);

    const list = ExpertIdeaListDataSchema.parse(
      (await as(seniors.cookie).get('experts/ideas').expect(200)).body.data,
    );
    expect(list.items).toEqual([
      expect.objectContaining({
        opinions: 0,
        idea: expect.objectContaining({ id }),
      }),
    ]);
    await as(health.cookie).get(`experts/ideas/${id}`).expect(404);
    await as(health.cookie)
      .post(`experts/ideas/${id}/messages`, { content: 'Spoza dziedziny' })
      .expect(404);

    const detail = ExpertIdeaDetailDataSchema.parse(
      (
        await as(seniors.cookie)
          .post(`experts/ideas/${id}/messages`, {
            content: 'Warto dodać partnera lokalnego.',
          })
          .expect(200)
      ).body.data,
    );
    expect(detail.messages.at(-1)).toMatchObject({
      author: 'EXPERT',
      authorName: 'Maria Senioralna',
    });
    expect(sent.at(-1)).toEqual({
      to: 'autor@example.com',
      subject: `Ekspert dodał opinię do pomysłu: ${idea.title}`,
    });

    expect(
      IdeaDataSchema.parse((await author('').expect(200)).body.data).idea
        .unreadReply,
    ).toBe(true);
    const thread = IdeaThreadDataSchema.parse(
      (await author('/thread').expect(200)).body.data,
    );
    expect(thread.status).toBe('SUBMITTED');
    expect(
      (await prisma.idea.findUniqueOrThrow({ where: { id } })).awaitsRops,
    ).toBe(true);
    expect(thread.messages.map((item) => item.author)).toEqual(['EXPERT']);

    const moderation = ModerationDetailDataSchema.parse(
      (
        await rops(`ideas/${id}/messages`, { content: 'Dziękujemy.' }).expect(
          200,
        )
      ).body.data,
    );
    expect(moderation.messages.map((item) => item.author)).toEqual([
      'EXPERT',
      'ROPS',
    ]);
    const queue = ExpertIdeaListDataSchema.parse(
      (await as(seniors.cookie).get('experts/ideas').expect(200)).body.data,
    );
    expect(queue.items[0]?.opinions).toBe(1);
  });
});
