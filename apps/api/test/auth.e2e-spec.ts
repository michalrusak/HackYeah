import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  AuthSessionResponseSchema,
  MyTesterProfileResponseSchema,
  type TesterProfileInput,
} from '@repo/api-contracts';
import request from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { sessionCookieOptions } from '../src/modules/auth/auth-http.js';
import { TestersModule } from '../src/modules/testers/testers.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { connectTestersDatabase, createTestersDatabase } from './testers-db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const origin = 'http://localhost:4200';
const password = 'My secure password 123!';
const profileInput: TesterProfileInput = {
  displayName: 'Tester konta',
  city: 'Kraków',
  bio: 'Testuję innowacyjne rozwiązania z wykorzystaniem własnego komputera.',
  skills: ['Testowanie'],
  resources: ['Komputer'],
  interests: ['Edukacja'],
  accessibilityNeeds: '',
  availability: 'remote',
};
const uniqueLogin = (): string =>
  `test_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

function cookieFrom(
  headers: Record<string, string | string[] | undefined>,
): string {
  const cookies = headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string')
    throw new Error('Missing session cookie');
  const cookie = cookies[0].split(';')[0];
  if (!cookie) throw new Error('Missing session cookie');
  return cookie;
}

describe.skipIf(!databaseUrl)('Account authentication with PostgreSQL', () => {
  let app: INestApplication;
  let database: PrismaClient;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
    const schema = await createTestersDatabase(databaseUrl);
    database = connectTestersDatabase(databaseUrl, schema);
    await database.$connect();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule,
        TestersModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({}))
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    // Only the randomly created test schema is touched.
    await database?.session.deleteMany();
    await database?.account.deleteMany();
    await database?.testerAssignment.deleteMany();
    await database?.testerSearch.deleteMany();
    await database?.testerProfile.deleteMany();
    await app?.close();
    await database?.$disconnect();
  });

  async function register(
    login = uniqueLogin(),
    legacyKey?: string,
  ): Promise<{ cookie: string; login: string; id: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login, password, ...(legacyKey ? { legacyKey } : {}) })
      .expect(201);
    const { user } = AuthSessionResponseSchema.parse(response.body).data;
    if (!user) throw new Error('Expected account');
    return {
      cookie: cookieFrom(response.headers),
      login: user.login,
      id: user.id,
    };
  }

  it('registers, hashes credentials, logs out and logs back in from another client', async () => {
    const login = uniqueLogin();
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login: login.toUpperCase(), password })
      .expect(201);
    const cookie = cookieFrom(response.headers);
    const cookieHeader = JSON.stringify(response.headers['set-cookie']);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain('Path=/api');
    const account = await database.account.findUniqueOrThrow({
      where: { login },
    });
    expect(account.passwordHash).not.toContain(password);
    expect(account.passwordHash).toMatch(/^scrypt\$/);
    const token = cookie.slice(cookie.indexOf('=') + 1);
    const session = await database.session.findUniqueOrThrow({
      where: { tokenHash: hash(token) },
    });
    expect(session.tokenHash).not.toBe(token);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(AuthSessionResponseSchema.parse(me.body).data.user).toEqual({
      id: account.id,
      login,
      expert: null,
    });
    expect(JSON.stringify(me.body)).not.toMatch(/password|ownerHash|token/i);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', cookie)
      .expect(401);
    expect(
      await database.session.findUnique({ where: { tokenHash: hash(token) } }),
    ).toBeNull();
    const fresh = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ login, password })
      .expect(200);
    expect(cookieFrom(fresh.headers)).not.toBe(cookie);
    await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', cookieFrom(fresh.headers))
      .expect(200);
    const rotated = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('Cookie', cookieFrom(fresh.headers))
      .send({ login, password })
      .expect(200);
    expect(cookieFrom(rotated.headers)).not.toBe(cookieFrom(fresh.headers));
    await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', cookieFrom(fresh.headers))
      .expect(401);
  });

  it('rejects duplicate login and returns identical errors for unknown login and wrong password', async () => {
    const account = await register();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login: account.login.toUpperCase(), password })
      .expect(409);
    const wrong = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ login: account.login, password: 'wrong-password' })
      .expect(401);
    const missing = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ login: uniqueLogin(), password: 'wrong-password' })
      .expect(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it('binds profile writes and search ownership to the signed-in account despite another owner header', async () => {
    const first = await register();
    const second = await register();
    const response = await request(app.getHttpServer())
      .put('/api/testers/profile/me')
      .set('Origin', origin)
      .set('Cookie', first.cookie)
      .set('X-Tester-Key', randomBytes(32).toString('hex'))
      .send(profileInput)
      .expect(200);
    const profile = MyTesterProfileResponseSchema.parse(response.body).data
      .profile;
    expect(profile?.displayName).toBe(profileInput.displayName);
    const stranger = await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', second.cookie)
      .expect(200);
    expect(
      MyTesterProfileResponseSchema.parse(stranger.body).data.profile,
    ).toBeNull();
    const account = await database.account.findUniqueOrThrow({
      where: { id: first.id },
    });
    const search = await database.testerSearch.create({
      data: {
        ownerHash: account.ownerHash,
        query: 'Tester z komputerem',
        summary: 'Test',
        matches: [],
        candidateCount: 1,
        totalProfiles: 1,
        candidateLimit: 40,
      },
    });
    await request(app.getHttpServer())
      .get(`/api/testers/searches/${search.id}`)
      .set('Cookie', second.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/testers/searches/${search.id}/assignments`)
      .set('Origin', origin)
      .set('Cookie', second.cookie)
      .send({ profileId: profile?.id })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/testers/searches/${search.id}`)
      .set('Cookie', first.cookie)
      .expect(200);
  });

  it('claims a legacy profile and search history once without leaving the old key as an auth bypass', async () => {
    const legacyKey = randomBytes(32).toString('hex');
    const ownerHash = hash(legacyKey);
    const profile = await database.testerProfile.create({
      data: { ...profileInput, ownerHash },
    });
    const search = await database.testerSearch.create({
      data: {
        ownerHash,
        query: 'Stare wyszukiwanie',
        summary: 'Test',
        matches: [],
        candidateCount: 1,
        totalProfiles: 1,
        candidateLimit: 40,
      },
    });
    const account = await register(uniqueLogin(), legacyKey);
    const own = await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', account.cookie)
      .expect(200);
    expect(MyTesterProfileResponseSchema.parse(own.body).data.profile?.id).toBe(
      profile.id,
    );
    await request(app.getHttpServer())
      .get(`/api/testers/searches/${search.id}`)
      .set('Cookie', account.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('X-Tester-Key', legacyKey)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/testers/searches/${search.id}`)
      .set('X-Tester-Key', legacyKey)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ login: uniqueLogin(), password, legacyKey })
      .expect(409);
  });

  it('rejects expired cookies even when a guest key is also supplied', async () => {
    const account = await register();
    await database.session.updateMany({
      where: { accountId: account.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .get('/api/testers/profile/me')
      .set('Cookie', account.cookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/testers/searches')
      .set('Cookie', account.cookie)
      .set('X-Tester-Key', randomBytes(32).toString('hex'))
      .expect(401);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', account.cookie)
      .expect(200);
    expect(AuthSessionResponseSchema.parse(me.body).data.user).toBeNull();
    expect(JSON.stringify(me.headers['set-cookie'])).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
  });

  it('blocks missing or foreign origins before setting cookies or mutating profiles', async () => {
    const account = await register();
    for (const endpoint of ['login', 'logout']) {
      await request(app.getHttpServer())
        .post(`/api/auth/${endpoint}`)
        .set('Cookie', account.cookie)
        .send({ login: account.login, password })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/auth/${endpoint}`)
        .set('Origin', 'https://attacker.invalid')
        .set('Cookie', account.cookie)
        .send({ login: account.login, password })
        .expect(403);
    }
    await request(app.getHttpServer())
      .put('/api/testers/profile/me')
      .set('Cookie', account.cookie)
      .set('Origin', 'https://attacker.invalid')
      .send(profileInput)
      .expect(403);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', account.cookie)
      .expect(200);
    expect(AuthSessionResponseSchema.parse(me.body).data.user?.id).toBe(
      account.id,
    );
  });

  it('sets Secure session cookies in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(sessionCookieOptions().secure).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rate-limits repeated login attempts', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ login: uniqueLogin(), password });
      if (response.status === 429) {
        limited = true;
        break;
      }
      expect(response.status).toBe(401);
    }
    expect(limited).toBe(true);
  });
});
