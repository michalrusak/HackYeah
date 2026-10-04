import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import {
  AdminSessionSchema,
  ContactListDataSchema,
  ContactQueueDataSchema,
  ContactThreadDataSchema,
} from '@repo/api-contracts';
import { randomBytes, scryptSync } from 'node:crypto';
import request from 'supertest';
import { ContactModule } from '../src/modules/contact/contact.module.js';
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
  firstName: 'Anna',
  lastName: 'Testowa',
  organization: 'Fikcyjna Fundacja',
  category: 'PARTNERSHIP',
  subject: 'Wspólny projekt dla seniorów',
  initialMessage: 'Fikcyjna wiadomość wyłącznie do testów.',
};

describe.skipIf(!databaseUrl)('ROPS contact with isolated PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: string[] = [];

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
      ],
    })
      .overrideProvider(MailService)
      .useValue({
        notifyRops: (subject: string) => {
          sent.push(subject);
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
    await prisma.account.deleteMany({
      where: { login: { startsWith: 'contact-e2e-' } },
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
  async function account(name: string): Promise<string> {
    const response = await http()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login: `contact-e2e-${name}`, password: 'Synthetic-pass-123' })
      .expect(201);
    return cookieOf(response);
  }
  async function admin() {
    const response = await http()
      .post('/api/knowledge/admin/login')
      .set('Origin', origin)
      .send({ password })
      .expect(200);
    return {
      cookie: cookieOf(response),
      csrfToken: AdminSessionSchema.parse(response.body.data).csrfToken,
    };
  }

  it('requires an account and ignores the old role headers', async () => {
    await http().get('/api/contact/conversations').expect(401);
    await http()
      .get('/api/contact/conversations')
      .set('user-id', 'mock-employee-456')
      .set('user-role', 'ROPS_EMPLOYEE')
      .expect(401);
    await http()
      .post('/api/contact/conversations')
      .set('Origin', origin)
      .send(input)
      .expect(401);
  });

  it('keeps conversations private to their owner', async () => {
    const owner = await account('owner');
    const stranger = await account('stranger');
    const created = ContactThreadDataSchema.parse(
      (
        await http()
          .post('/api/contact/conversations')
          .set('Cookie', owner)
          .set('Origin', origin)
          .send(input)
          .expect(201)
      ).body.data,
    );
    const id = created.conversation.id;
    expect(created.conversation).toMatchObject({
      category: 'PARTNERSHIP',
      status: 'AWAITING_ROPS',
      organization: 'Fikcyjna Fundacja',
    });

    const foreign = ContactListDataSchema.parse(
      (
        await http()
          .get('/api/contact/conversations')
          .set('Cookie', stranger)
          .expect(200)
      ).body.data,
    );
    expect(foreign.items).toEqual([]);
    await http()
      .get(`/api/contact/conversations/${id}`)
      .set('Cookie', stranger)
      .expect(404);
    await http()
      .post(`/api/contact/conversations/${id}/messages`)
      .set('Cookie', stranger)
      .set('Origin', origin)
      .send({ content: 'Cudza wiadomość' })
      .expect(404);
  });

  it('carries the question to the ROPS inbox and the answer back to the user', async () => {
    const owner = await account('dialog');
    const asUser = (path: string, body: object) =>
      http()
        .post(`/api/contact/conversations${path}`)
        .set('Cookie', owner)
        .set('Origin', origin)
        .send(body);
    await asUser('', { ...input, category: 'OTHER' }).expect(400);
    const id = ContactThreadDataSchema.parse(
      (await asUser('', input).expect(201)).body.data,
    ).conversation.id;
    expect(sent).toEqual([`Nowa sprawa (partnerstwo): ${input.subject}`]);

    await http().get('/api/knowledge/admin/contact').expect(401);
    await http()
      .get('/api/knowledge/admin/contact')
      .set('Cookie', owner)
      .expect(401);
    const auth = await admin();
    const queue = ContactQueueDataSchema.parse(
      (
        await http()
          .get('/api/knowledge/admin/contact')
          .set('Cookie', auth.cookie)
          .expect(200)
      ).body.data,
    );
    expect(queue.attention).toBe(1);
    expect(queue.items[0]).toMatchObject({ id, status: 'AWAITING_ROPS' });

    const asRops = (path: string, body: object) =>
      http()
        .post(`/api/knowledge/admin/contact/${id}/${path}`)
        .set('Cookie', auth.cookie)
        .set('Origin', origin)
        .set('X-Knowledge-CSRF', auth.csrfToken)
        .send(body);
    await http()
      .post(`/api/knowledge/admin/contact/${id}/messages`)
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .send({ content: 'Bez tokenu CSRF' })
      .expect(403);
    await asRops('messages', { content: 'Chętnie porozmawiamy.' }).expect(200);

    const thread = ContactThreadDataSchema.parse(
      (
        await http()
          .get(`/api/contact/conversations/${id}`)
          .set('Cookie', owner)
          .expect(200)
      ).body.data,
    );
    expect(thread.conversation.status).toBe('ANSWERED');
    expect(thread.messages.map((item) => [item.author, item.content])).toEqual([
      ['USER', input.initialMessage],
      ['ROPS', 'Chętnie porozmawiamy.'],
    ]);

    const closed = ContactThreadDataSchema.parse(
      (await asRops('close', {}).expect(200)).body.data,
    );
    expect(closed.conversation.status).toBe('CLOSED');
    const reopened = ContactThreadDataSchema.parse(
      (
        await asUser(`/${id}/messages`, { content: 'Jeszcze jedno.' }).expect(
          200,
        )
      ).body.data,
    );
    expect(reopened.conversation.status).toBe('AWAITING_ROPS');
    expect(sent.at(-1)).toBe(`Nowa wiadomość w sprawie: ${input.subject}`);
  });
});
