import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AcknowledgementSchema,
  AdminSessionSchema,
  KnowledgeInputSchema,
  KnowledgeListSchema,
  KnowledgeSummarySchema,
  KnowledgeOverviewSchema,
  KnowledgeResourceSchema,
  KnowledgeTrendsSchema,
  type KnowledgeInput,
} from '@repo/api-contracts';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import request from 'supertest';
import { KnowledgeModule } from '../src/modules/knowledge/knowledge.module.js';
import { KnowledgeRepository } from '../src/modules/knowledge/knowledge.repository.js';
import { CatalogRepository } from '../src/modules/matchmaking/catalog.repository.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const databaseUrl = process.env.KNOWLEDGE_TEST_DATABASE_URL;
const password = 'Synthetic test password only';
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const origin = 'http://localhost:4200';
const published: KnowledgeInput = KnowledgeInputSchema.parse({
  id: 'test-senior',
  title: 'Testowa innowacja dla seniorów',
  summary: 'Fikcyjny opis wyłącznie do testów.',
  kind: 'innovation',
  scope: 'general',
  areas: ['Seniorzy'],
  audiences: ['Seniorzy'],
  needs: ['Relacje społeczne'],
  sourceUrl:
    'https://rops.krakow.pl/innowacje-spoleczne/biblioteka-innowacji-spolecznych/kategorie',
  sourceLabel: 'Źródło testowe',
  verifiedAt: '2026-10-03',
  publicationYear: null,
  videoPageUrl: null,
  status: 'published',
});

describe.skipIf(!databaseUrl)('Knowledge API with isolated PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: KnowledgeRepository;

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
            }),
          ],
        }),
        KnowledgeModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    repository = app.get(KnowledgeRepository);
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.knowledgeResource.deleteMany(),
      prisma.knowledgeAdminSession.deleteMany(),
      prisma.needReceipt.deleteMany(),
      prisma.needDailyCount.deleteMany(),
      prisma.needAreaCount.deleteMany(),
      prisma.needTagCount.deleteMany(),
      prisma.needSourceCount.deleteMany(),
      prisma.searchPhraseCount.deleteMany(),
    ]);
    await repository.create(published);
    await repository.create({
      ...published,
      id: 'private-draft',
      title: 'Ukryty szkic',
      status: 'draft',
    });
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
    return {
      cookie,
      csrfToken: session.csrfToken,
      rawCookie: String(rawCookie),
    };
  }

  it('shows only published resources, filters by area and search, and paginates', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/resources?area=Seniorzy&q=senior&pageSize=1')
      .expect(200);
    const data = KnowledgeListSchema.parse(response.body.data);
    expect(data.total).toBe(1);
    expect(data.resources[0].id).toBe(published.id);
    expect(data.resources[0].sourceUrl).toBe(published.sourceUrl);
    const empty = await request(app.getHttpServer())
      .get('/api/knowledge/resources?area=Bezdomno%C5%9B%C4%87')
      .expect(200);
    expect(KnowledgeListSchema.parse(empty.body.data).total).toBe(0);
  });

  it('returns key figures and filters resources that have a video page', async () => {
    await repository.create({
      ...published,
      id: 'test-video',
      videoPageUrl: published.sourceUrl,
      facts: [{ value: '30,1%', label: 'Fikcyjny wskaźnik do testów.' }],
    });
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/resources?video=1')
      .expect(200);
    const data = KnowledgeListSchema.parse(response.body.data);
    expect(data.resources.map((item) => item.id)).toEqual(['test-video']);
    await repository.create({
      ...published,
      id: 'test-youtube',
      videoUrl: 'https://www.youtube.com/watch?v=o5TP10ZStNA',
    });
    const both = await request(app.getHttpServer())
      .get('/api/knowledge/resources?video=1&q=testowa')
      .expect(200);
    expect(
      KnowledgeListSchema.parse(both.body.data)
        .resources.map((item) => item.videoUrl)
        .sort(),
    ).toEqual(['https://www.youtube.com/watch?v=o5TP10ZStNA', null]);
    expect(
      KnowledgeInputSchema.safeParse({
        ...published,
        videoUrl: 'https://evil.example/watch?v=o5TP10ZStNA',
      }).success,
    ).toBe(false);
    expect(data.resources[0].facts).toEqual([
      { value: '30,1%', label: 'Fikcyjny wskaźnik do testów.' },
    ]);
    await request(app.getHttpServer())
      .get('/api/knowledge/resources?video=yes')
      .expect(400);
  });

  it('never exposes a draft by its identifier', async () => {
    await request(app.getHttpServer())
      .get('/api/knowledge/resources/private-draft')
      .expect(404);
  });

  it('overview excludes drafts and includes all eight areas', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/overview')
      .expect(200);
    const data = KnowledgeOverviewSchema.parse(response.body.data);
    expect(data.total).toBe(1);
    expect(data.areas).toHaveLength(8);
    expect(data.areas.find((row) => row.area === 'Seniorzy')?.count).toBe(1);
  });

  it.each(['/trends', '/resources', '/session'])(
    'protects administrator data %s',
    async (path) => {
      await request(app.getHttpServer())
        .get('/api/knowledge/admin' + path)
        .expect(401);
    },
  );

  it('rejects wrong password and login from another origin', async () => {
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/login')
      .set('Origin', origin)
      .send({ password: 'wrong' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/login')
      .set('Origin', 'https://other.example')
      .send({ password })
      .expect(403);
  });

  it('uses an HttpOnly SameSite cookie, stores only its hash and restores a session', async () => {
    const auth = await login();
    expect(auth.rawCookie).toContain('HttpOnly');
    expect(auth.rawCookie).toContain('SameSite=Strict');
    expect(auth.rawCookie).toContain('Path=/api/knowledge/admin');
    const row = await prisma.knowledgeAdminSession.findFirstOrThrow();
    expect(auth.cookie).not.toContain(row.id);
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/admin/session')
      .set('Cookie', auth.cookie)
      .expect(200);
    expect(AdminSessionSchema.parse(response.body.data).csrfToken).toBe(
      auth.csrfToken,
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejects writes without a session or a valid CSRF token', async () => {
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/resources')
      .send(published)
      .expect(401);
    const auth = await login();
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/resources')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .send(published)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/resources')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', 'é'.repeat(64))
      .send(published)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/resources')
      .set('Cookie', auth.cookie)
      .set('Origin', 'https://other.example')
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send(published)
      .expect(403);
  });

  it('summarises the verification queue and filters it for administrators only', async () => {
    await repository.create({
      ...published,
      id: 'old-check',
      verifiedAt: '2025-01-15',
    });
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/summary')
      .expect(401);
    const auth = await login();
    const get = (path: string) =>
      request(app.getHttpServer())
        .get(`/api/knowledge/admin/${path}`)
        .set('Cookie', auth.cookie)
        .expect(200);
    const summary = KnowledgeSummarySchema.parse(
      (await get('summary')).body.data,
    );
    expect(summary).toMatchObject({ published: 2, draft: 1, stale: 1 });
    const ids = async (query: string) =>
      KnowledgeListSchema.parse(
        (await get(`resources?${query}`)).body.data,
      ).resources.map((item) => item.id);
    expect(await ids('status=draft')).toEqual(['private-draft']);
    expect(await ids('stale=1')).toEqual(['old-check']);
    const open = await request(app.getHttpServer())
      .get('/api/knowledge/resources?status=draft&stale=1')
      .expect(200);
    expect(
      KnowledgeListSchema.parse(open.body.data)
        .resources.map((item) => item.id)
        .sort(),
    ).toEqual(['old-check', published.id]);
  });

  it('updates and publishes a draft immediately and prevents stale overwrites', async () => {
    const auth = await login();
    const input = { ...published, id: 'private-draft', title: 'Nowa nazwa' };
    const response = await request(app.getHttpServer())
      .put('/api/knowledge/admin/resources/private-draft')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send({ resource: input, revision: 1 })
      .expect(200);
    expect(KnowledgeResourceSchema.parse(response.body.data).revision).toBe(2);
    await request(app.getHttpServer())
      .put('/api/knowledge/admin/resources/private-draft')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send({ resource: { ...input, title: 'Old overwrite' }, revision: 1 })
      .expect(409);
    const publicResponse = await request(app.getHttpServer())
      .get('/api/knowledge/resources/private-draft')
      .expect(200);
    expect(publicResponse.body.data.title).toBe('Nowa nazwa');
  });

  it('imports new resources as drafts without overwriting existing IDs', async () => {
    const auth = await login();
    const response = await request(app.getHttpServer())
      .post('/api/knowledge/admin/import')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send({
        resources: [
          { ...published, title: 'Overwrite attempt' },
          { ...published, id: 'new-import' },
        ],
      })
      .expect(201);
    expect(response.body.data.imported).toBe(1);
    expect((await repository.find(published.id))?.title).toBe(published.title);
    expect(await repository.find('new-import')).toBeNull();
  });

  it.each([
    { sourceUrl: 'https://evil.example/resource' },
    { sourceUrl: 'javascript:alert(1)' },
    { sourceUrl: 'https://user:secret@rops.krakow.pl/' },
    { sourceUrl: '' },
    { sourceUrl: 'not-a-url' },
    { areas: ['Unknown area'] },
    { needs: ['Unknown need'] },
    { verifiedAt: '2026-02-31' },
    { verifiedAt: '2099-01-01' },
    { audiences: [] },
  ])('validates editorial data %j', async (change) => {
    const auth = await login();
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/resources')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send({ ...published, id: 'invalid-resource', ...change })
      .expect(400);
  });

  it('requires consent and rejects extra free text or unknown categories', async () => {
    const data = {
      id: randomUUID(),
      areas: ['Seniorzy'],
      needs: [],
      consent: true,
    };
    for (const body of [
      { ...data, consent: false },
      { ...data, description: 'do not store' },
      { ...data, areas: ['unknown'] },
      { ...data, areas: [] },
    ]) {
      await request(app.getHttpServer())
        .post('/api/knowledge/needs')
        .send(body)
        .expect(400);
    }
    expect(await prisma.needReceipt.count()).toBe(0);
  });

  it('counts unique submissions once, deduplicates tags, and exposes aggregates only to administrators', async () => {
    const body = {
      id: randomUUID(),
      areas: ['Seniorzy', 'Seniorzy', 'Zdrowie'],
      needs: ['Relacje społeczne', 'Relacje społeczne'],
      consent: true,
    };
    for (let index = 0; index < 2; index++) {
      const response = await request(app.getHttpServer())
        .post('/api/knowledge/needs')
        .send(body)
        .expect(201);
      expect(AcknowledgementSchema.parse(response.body.data).accepted).toBe(
        true,
      );
    }
    const auth = await login();
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/admin/trends')
      .set('Cookie', auth.cookie)
      .expect(200);
    const data = KnowledgeTrendsSchema.parse(response.body.data);
    expect(data.currentTotal).toBe(1);
    expect(data.areas.find((area) => area.area === 'Seniorzy')?.current).toBe(
      1,
    );
    expect(data.needs[0].count).toBe(1);
    expect(data.daily).toHaveLength(30);
    const receipt = await prisma.needReceipt.findFirstOrThrow();
    expect(Object.keys(receipt).sort()).toEqual([
      'createdAt',
      'id',
      'updatedAt',
    ]);
  });

  it('collects need signals from searches and flags a rising area for administrators', async () => {
    const search = (query: string) =>
      request(app.getHttpServer())
        .get(`/api/knowledge/resources?${query}`)
        .expect(200);
    const phrase = 'Jak wspomóc  młodzież w kryzysie zdrowia psychicznego';
    for (let index = 0; index < 5; index++)
      await search(`q=${encodeURIComponent(phrase)}`);
    await search(`q=${encodeURIComponent(phrase)}&page=2`);
    await search('q=senior&area=Zdrowie');
    await search('area=Zdrowie');
    await repository.recordNeed(
      { areas: ['Zdrowie psychiczne'], needs: ['Wsparcie emocjonalne'] },
      new Date(new Date().toISOString().slice(0, 10)),
      'matchmaking',
    );
    const auth = await login();
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/resources?q=senior')
      .set('Cookie', auth.cookie)
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/admin/trends')
      .set('Cookie', auth.cookie)
      .expect(200);
    const data = KnowledgeTrendsSchema.parse(response.body.data);
    const area = (name: string) =>
      data.areas.find((item) => item.area === name);
    expect(data.currentTotal).toBe(8);
    expect(area('Zdrowie psychiczne')).toMatchObject({
      current: 6,
      rising: true,
    });
    expect(area('Seniorzy')).toMatchObject({ current: 1, rising: false });
    expect(area('Zdrowie')?.current).toBe(2);
    expect(data.sources).toEqual([
      { source: 'matchmaking', count: 1 },
      { source: 'search', count: 6 },
      { source: 'browse', count: 1 },
      { source: 'form', count: 0 },
    ]);
    expect(data.phrases).toEqual([
      {
        phrase: 'jak wspomóc młodzież w kryzysie zdrowia psychicznego',
        count: 5,
      },
      { phrase: 'senior', count: 1 },
    ]);
    expect(await prisma.needReceipt.count()).toBe(0);
  });

  it('uses published database innovations in matchmaking and excludes withdrawn entries', async () => {
    const catalog = new CatalogRepository(repository);
    expect((await catalog.snapshot()).innovations.map((row) => row.id)).toEqual(
      [published.id],
    );
    await repository.update({ ...published, status: 'draft' }, 1);
    expect((await catalog.snapshot()).innovations).toEqual([]);
  });

  it('separates the two 30-day windows, zero fills days and excludes older records', async () => {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const ago = (days: number): Date =>
      new Date(today.getTime() - days * 86_400_000);
    for (const days of [0, 29, 30, 59, 60]) {
      await repository.recordNeed(
        { id: randomUUID(), areas: ['Seniorzy'], needs: [] },
        ago(days),
      );
    }
    const auth = await login();
    const response = await request(app.getHttpServer())
      .get('/api/knowledge/admin/trends')
      .set('Cookie', auth.cookie)
      .expect(200);
    const data = KnowledgeTrendsSchema.parse(response.body.data);
    expect(data.currentTotal).toBe(2);
    expect(data.previousTotal).toBe(2);
    expect(data.daily.reduce((sum, day) => sum + day.count, 0)).toBe(2);
    expect(data.daily.filter((day) => day.count === 0)).toHaveLength(28);
  });

  it('invalidates a session on logout, expiration and password rotation', async () => {
    const auth = await login();
    await request(app.getHttpServer())
      .post('/api/knowledge/admin/logout')
      .set('Cookie', auth.cookie)
      .set('Origin', origin)
      .set('X-Knowledge-CSRF', auth.csrfToken)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/session')
      .set('Cookie', auth.cookie)
      .expect(401);
    const expired = await login();
    await prisma.knowledgeAdminSession.updateMany({
      data: { expiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/session')
      .set('Cookie', expired.cookie)
      .expect(401);
    const rotated = await login();
    const config = app.get(ConfigService);
    config.set('KNOWLEDGE_ADMIN_PASSWORD_HASH', 'changed');
    await request(app.getHttpServer())
      .get('/api/knowledge/admin/session')
      .set('Cookie', rotated.cookie)
      .expect(401);
    config.set('KNOWLEDGE_ADMIN_PASSWORD_HASH', passwordHash);
  });
});
