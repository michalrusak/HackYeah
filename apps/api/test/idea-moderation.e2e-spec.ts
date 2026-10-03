import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import {
  AdminSessionSchema,
  CreatedIdeaDataSchema,
  IdeaDataSchema,
  IdeaListDataSchema,
  IdeaThreadDataSchema,
  ModerationDetailDataSchema,
  ModerationListDataSchema,
} from '@repo/api-contracts';
import { randomBytes, scryptSync } from 'node:crypto';
import request from 'supertest';
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
const input = {
  title: 'Sąsiedzka wypożyczalnia',
  essence: 'Fikcyjny pomysł wyłącznie do testów moderacji.',
  problem: 'Fikcyjny problem opisany na potrzeby testu.',
  targetAudience: 'Mieszkańcy',
  stage: 'POMYSL',
  contactEmail: 'autor@example.com',
};

describe.skipIf(!databaseUrl)(
  'Idea moderation with isolated PostgreSQL',
  () => {
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
                ROPS_NOTIFY_EMAIL: 'rops@example.com',
              }),
            ],
          }),
          ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
          KnowledgeModule,
          IdeaCreatorModule,
        ],
      })
        .overrideProvider(MailService)
        .useValue({
          ideaUrl: (id: string) => `${origin}/pomysly/${id}`,
          send: (to: string | null | undefined, subject: string) => {
            sent.push({ to, subject });
          },
          notifyRops: (subject: string) => {
            sent.push({ to: 'rops@example.com', subject });
          },
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
    });
    afterAll(async () => {
      await app?.close();
    });

    async function login() {
      const response = await request(app.getHttpServer())
        .post('/api/knowledge/admin/login')
        .set('Origin', origin)
        .send({ password })
        .expect(200);
      const session = AdminSessionSchema.parse(response.body.data);
      const rawCookie = response.headers['set-cookie'];
      const cookie = (
        Array.isArray(rawCookie) ? rawCookie[0] : String(rawCookie)
      ).split(';')[0];
      return { cookie, csrfToken: session.csrfToken };
    }
    async function createIdea() {
      const response = await request(app.getHttpServer())
        .post('/api/ideas')
        .send(input)
        .expect(201);
      const created = CreatedIdeaDataSchema.parse(response.body.data);
      return { id: created.idea.id, token: created.editToken };
    }
    const http = () => request(app.getHttpServer());

    it('holds a submitted idea for ROPS, notifies the administrator and publishes only after a decision', async () => {
      const idea = await createIdea();
      const submitted = await http()
        .post(`/api/ideas/${idea.id}/publish`)
        .set('X-Edit-Token', idea.token)
        .expect(200);
      expect(IdeaDataSchema.parse(submitted.body.data).idea.status).toBe(
        'SUBMITTED',
      );
      expect(sent).toEqual([
        {
          to: 'rops@example.com',
          subject: `Nowy pomysł do weryfikacji: ${input.title}`,
        },
      ]);
      await http().get(`/api/ideas/${idea.id}`).expect(404);
      const list = await http().get('/api/ideas').expect(200);
      expect(IdeaListDataSchema.parse(list.body.data).total).toBe(0);

      await http().get('/api/knowledge/admin/ideas').expect(401);
      const auth = await login();
      const queue = ModerationListDataSchema.parse(
        (
          await http()
            .get('/api/knowledge/admin/ideas')
            .set('Cookie', auth.cookie)
            .expect(200)
        ).body.data,
      );
      expect(queue.attention).toBe(1);
      expect(queue.items[0]).toMatchObject({
        awaitsRops: true,
        idea: { id: idea.id, status: 'SUBMITTED' },
      });

      await http()
        .post(`/api/knowledge/admin/ideas/${idea.id}/decision`)
        .set('Cookie', auth.cookie)
        .set('Origin', origin)
        .send({ decision: 'PUBLISH' })
        .expect(403);
      const decided = await http()
        .post(`/api/knowledge/admin/ideas/${idea.id}/decision`)
        .set('Cookie', auth.cookie)
        .set('Origin', origin)
        .set('X-Knowledge-CSRF', auth.csrfToken)
        .send({ decision: 'PUBLISH', message: 'Dziękujemy, publikujemy.' })
        .expect(200);
      const detail = ModerationDetailDataSchema.parse(decided.body.data);
      expect(detail.idea.status).toBe('PUBLISHED');
      expect(detail.awaitsRops).toBe(false);
      expect(sent.at(-1)).toEqual({
        to: 'autor@example.com',
        subject: `Twój pomysł został opublikowany: ${input.title}`,
      });
      const open = await http().get(`/api/ideas/${idea.id}`).expect(200);
      expect(IdeaDataSchema.parse(open.body.data).idea.unreadReply).toBe(false);
    });

    it('carries the request for changes to the author and the reply back to ROPS', async () => {
      const idea = await createIdea();
      const asAuthor = (path: string) => ({
        get: () =>
          http()
            .get(`/api/ideas/${idea.id}${path}`)
            .set('X-Edit-Token', idea.token),
        post: (body: object) =>
          http()
            .post(`/api/ideas/${idea.id}${path}`)
            .set('X-Edit-Token', idea.token)
            .send(body),
      });
      await asAuthor('/thread').post({ content: 'Za wcześnie' }).expect(409);
      await asAuthor('/publish').post({}).expect(200);
      const auth = await login();
      const admin = (path: string, body: object) =>
        http()
          .post(`/api/knowledge/admin/ideas/${idea.id}/${path}`)
          .set('Cookie', auth.cookie)
          .set('Origin', origin)
          .set('X-Knowledge-CSRF', auth.csrfToken)
          .send(body);
      await admin('decision', { decision: 'REQUEST_CHANGES' }).expect(400);
      await admin('decision', {
        decision: 'REQUEST_CHANGES',
        message: 'Doprecyzuj, kto będzie odbiorcą.',
      }).expect(200);

      const owned = IdeaDataSchema.parse((await asAuthor('').get()).body.data);
      expect(owned.idea).toMatchObject({
        status: 'NEEDS_CHANGES',
        unreadReply: true,
      });
      await http().get(`/api/ideas/${idea.id}/thread`).expect(403);
      const thread = IdeaThreadDataSchema.parse(
        (await asAuthor('/thread').get().expect(200)).body.data,
      );
      expect(
        thread.messages.map((item) => [item.author, item.content]),
      ).toEqual([['ROPS', 'Doprecyzuj, kto będzie odbiorcą.']]);
      expect(
        IdeaDataSchema.parse((await asAuthor('').get()).body.data).idea
          .unreadReply,
      ).toBe(false);

      await asAuthor('/thread')
        .post({ content: 'Odbiorcami są seniorzy.' })
        .expect(200);
      await asAuthor('/publish').post({}).expect(200);
      const detail = ModerationDetailDataSchema.parse(
        (
          await http()
            .get(`/api/knowledge/admin/ideas/${idea.id}`)
            .set('Cookie', auth.cookie)
            .expect(200)
        ).body.data,
      );
      expect(detail).toMatchObject({
        awaitsRops: true,
        idea: { status: 'SUBMITTED' },
      });
      expect(detail.messages.map((item) => item.author)).toEqual([
        'ROPS',
        'AUTHOR',
      ]);
      expect(sent.map((item) => item.to)).toEqual([
        'rops@example.com',
        'autor@example.com',
        'rops@example.com',
        'rops@example.com',
      ]);
    });

    it('keeps drafts private from the administrator', async () => {
      const idea = await createIdea();
      const auth = await login();
      await http()
        .get(`/api/knowledge/admin/ideas/${idea.id}`)
        .set('Cookie', auth.cookie)
        .expect(404);
      const queue = ModerationListDataSchema.parse(
        (
          await http()
            .get('/api/knowledge/admin/ideas')
            .set('Cookie', auth.cookie)
            .expect(200)
        ).body.data,
      );
      expect(queue).toEqual({ items: [], attention: 0 });
    });
  },
);
