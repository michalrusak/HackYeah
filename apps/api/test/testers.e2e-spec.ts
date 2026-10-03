import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  ApiErrorResponseSchema,
  ErrorCodes,
  MyTesterProfileResponseSchema,
  TesterProfilesResponseSchema,
  TesterSearchResponseSchema,
  TesterSearchesResponseSchema,
  type TesterAiResult,
  type TesterProfile,
  type TesterProfileInput,
  type TesterSearchData,
} from '@repo/api-contracts';
import request from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { TestersModule } from '../src/modules/testers/testers.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { connectTestersDatabase, createTestersDatabase } from './testers-db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const profileInput: TesterProfileInput = {
  displayName: 'Tester integracyjny',
  city: 'Kraków',
  bio: 'Chętnie testuję społeczne rozwiązania i udostępniam komputer do badań.',
  skills: ['Testowanie aplikacji'],
  resources: ['Komputer z GPU i 64 GB RAM'],
  accessibilityNeeds: 'Korzystam z czytnika ekranu.',
  interests: ['Dostępność cyfrowa'],
  availability: 'remote',
  consent: true,
  isActive: true,
};
const newOwner = (): string => randomBytes(32).toString('hex');

describe.skipIf(!databaseUrl)(
  'Tester API with PostgreSQL (TEST_DATABASE_URL)',
  () => {
    let app: INestApplication;
    let databaseSchema: string;
    let database: PrismaClient;
    const profileIds: string[] = [];
    const searchIds: string[] = [];
    const fetchMock = vi.fn<typeof fetch>();

    async function startApp(): Promise<INestApplication> {
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
      database = connectTestersDatabase(databaseUrl, databaseSchema);
      await database.$connect();
      const module = await Test.createTestingModule({
        imports: [TestersModule],
      })
        .overrideProvider(PrismaService)
        .useValue(database)
        .overrideProvider(ConfigService)
        .useValue(new ConfigService({ OPENROUTER_API_KEY: 'test-ai-key' }))
        .compile();
      const instance = module.createNestApplication();
      instance.setGlobalPrefix('api');
      await instance.init();
      return instance;
    }

    async function saveProfile(
      owner: string,
      changes: Partial<TesterProfileInput> = {},
    ): Promise<TesterProfile> {
      const response = await request(app.getHttpServer())
        .put('/api/testers/profile/me')
        .set('X-Tester-Key', owner)
        .send({ ...profileInput, ...changes })
        .expect(200);
      const { profile } = MyTesterProfileResponseSchema.parse(
        response.body,
      ).data;
      if (!profile) throw new Error('Expected a saved tester profile');
      profileIds.push(profile.id);
      return profile;
    }

    function completion(matches: TesterAiResult['matches']): Response {
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                summary: 'Osoby do testów dostępności.',
                matches,
              }),
            },
          },
        ],
      });
    }

    function aiResponse(matches: TesterAiResult['matches']): void {
      fetchMock.mockImplementation(async () => completion(matches));
    }

    async function search(
      owner: string,
      query = 'Szukam osoby z mocnym komputerem do testów dostępności.',
    ): Promise<TesterSearchData> {
      const response = await request(app.getHttpServer())
        .post('/api/testers/search')
        .set('X-Tester-Key', owner)
        .send({ query })
        .expect(200);
      const { data } = TesterSearchResponseSchema.parse(response.body);
      searchIds.push(data.id);
      return data;
    }

    beforeAll(async () => {
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
      databaseSchema = await createTestersDatabase(databaseUrl);
      vi.stubGlobal('fetch', fetchMock);
      app = await startApp();
    });

    beforeEach(() => {
      fetchMock.mockReset();
      aiResponse([]);
    });

    afterAll(async () => {
      try {
        if (database) {
          if (searchIds.length) {
            await database.testerAssignment.deleteMany({
              where: { searchId: { in: searchIds } },
            });
            await database.testerSearch.deleteMany({
              where: { id: { in: searchIds } },
            });
          }
          if (profileIds.length) {
            await database.testerProfile.deleteMany({
              where: { id: { in: profileIds } },
            });
          }
        }
      } finally {
        await app?.close();
        await database?.$disconnect();
        vi.unstubAllGlobals();
      }
    });

    it('requires an owner key while allowing public browsing', async () => {
      await request(app.getHttpServer())
        .get('/api/testers/profile/me')
        .expect(401);
      for (const owner of ['', 'invalid-key']) {
        const response = await request(app.getHttpServer())
          .get('/api/testers/profile/me')
          .set('X-Tester-Key', owner)
          .expect(401);
        expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
          ErrorCodes.UNAUTHORIZED,
        );
      }
      const response = await request(app.getHttpServer())
        .get('/api/testers/profiles')
        .expect(200);
      TesterProfilesResponseSchema.parse(response.body);
    });

    it('validates consent, fields and search requests before persistence or AI', async () => {
      const owner = newOwner();
      for (const changes of [
        { consent: false },
        { displayName: ' ' },
        { availability: 'unknown' },
        { skills: ['x'.repeat(121)] },
        { ownerKey: newOwner() },
      ]) {
        const response = await request(app.getHttpServer())
          .put('/api/testers/profile/me')
          .set('X-Tester-Key', owner)
          .send({ ...profileInput, ...changes })
          .expect(400);
        expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      for (const query of ['', '   ', 'short', 'x'.repeat(2001)]) {
        await request(app.getHttpServer())
          .post('/api/testers/search')
          .set('X-Tester-Key', owner)
          .send({ query })
          .expect(400);
      }
      const own = await request(app.getHttpServer())
        .get('/api/testers/profile/me')
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        MyTesterProfileResponseSchema.parse(own.body).data.profile,
      ).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('creates and edits the same persistent profile without exposing the owner credential', async () => {
      const owner = newOwner();
      const created = await saveProfile(owner);
      const edited = await saveProfile(owner, {
        city: 'Warszawa',
        resources: ['Komputer z GPU i 128 GB RAM'],
      });
      expect(edited.id).toBe(created.id);
      const stored = await database.testerProfile.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.city).toBe('Warszawa');
      expect(stored.resources).toEqual(['Komputer z GPU i 128 GB RAM']);
      expect(stored.ownerHash).toBe(
        createHash('sha256').update(owner).digest('hex'),
      );
      expect(stored.ownerHash).not.toBe(owner);
      const other = await request(app.getHttpServer())
        .get('/api/testers/profile/me')
        .set('X-Tester-Key', newOwner())
        .expect(200);
      expect(
        MyTesterProfileResponseSchema.parse(other.body).data.profile,
      ).toBeNull();
      const catalog = await request(app.getHttpServer())
        .get('/api/testers/profiles')
        .expect(200);
      const publicProfiles = TesterProfilesResponseSchema.parse(catalog.body)
        .data.profiles;
      expect(
        publicProfiles.find((profile) => profile.id === created.id)?.city,
      ).toBe('Warszawa');
      expect(JSON.stringify(catalog.body)).not.toContain(owner);
      expect(JSON.stringify(catalog.body)).not.toContain(
        createHash('sha256').update(owner).digest('hex'),
      );
    });

    it('uses persisted active profiles in the real AI request and validates its result', async () => {
      const owner = newOwner();
      const active = await saveProfile(owner);
      const inactive = await saveProfile(newOwner(), { isActive: false });
      aiResponse([
        {
          profileId: active.id,
          score: 94,
          reason: 'Deklaruje wydajny komputer i testowanie aplikacji.',
          matchedTraits: ['Komputer z GPU i 64 GB RAM'],
        },
      ]);
      const result = await search(owner);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]?.profile.id).toBe(active.id);
      expect(result.matches[0]?.score).toBe(94);
      expect(result.assignedProfileIds).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = fetchMock.mock.calls[0]?.[1]?.body;
      expect(typeof body).toBe('string');
      expect(body).toContain(active.id);
      expect(body).toContain('64 GB RAM');
      expect(body).not.toContain(inactive.id);
      expect(body).not.toContain(owner);
      expect(body).not.toContain(
        createHash('sha256').update(owner).digest('hex'),
      );
      const stored = await database.testerSearch.findUnique({
        where: { id: result.id },
      });
      expect(stored).not.toBeNull();
    });

    it.each(['invented', 'inactive', 'duplicate'])(
      'rejects %s AI profile IDs instead of persisting invalid matches',
      async (scenario) => {
        const owner = newOwner();
        const profile = await saveProfile(owner);
        const inactive = await saveProfile(newOwner(), { isActive: false });
        const match = {
          profileId:
            scenario === 'invented'
              ? randomUUID()
              : scenario === 'inactive'
                ? inactive.id
                : profile.id,
          score: 99,
          reason: 'Kandydat proponowany przez AI.',
          matchedTraits: ['Komputer'],
        };
        aiResponse(scenario === 'duplicate' ? [match, match] : [match]);
        const before = await database.testerSearch.count();
        const response = await request(app.getHttpServer())
          .post('/api/testers/search')
          .set('X-Tester-Key', owner)
          .send({ query: 'Szukam testera z mocnym komputerem.' })
          .expect(502);
        expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
          ErrorCodes.AI_INVALID_RESPONSE,
        );
        expect(await database.testerSearch.count()).toBe(before);
      },
    );

    it('hides withdrawn profiles from past results and prevents unrelated assignments', async () => {
      const owner = newOwner();
      const profile = await saveProfile(owner);
      const unrelated = await saveProfile(newOwner());
      aiResponse([
        {
          profileId: profile.id,
          score: 92,
          reason: 'Ma odpowiedni komputer.',
          matchedTraits: ['Komputer'],
        },
      ]);
      const result = await search(owner);
      const path = `/api/testers/searches/${result.id}`;
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: unrelated.id })
        .expect(404);
      await saveProfile(owner, { isActive: false });
      const catalog = await request(app.getHttpServer())
        .get('/api/testers/profiles')
        .expect(200);
      expect(
        TesterProfilesResponseSchema.parse(catalog.body).data.profiles.map(
          (item) => item.id,
        ),
      ).not.toContain(profile.id);
      const history = await request(app.getHttpServer())
        .get(path)
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchResponseSchema.parse(history.body).data.matches,
      ).toEqual([]);
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: profile.id })
        .expect(404);
    });

    it('invalidates historical AI matches and assignments after an active profile is edited', async () => {
      const owner = newOwner();
      const profile = await saveProfile(owner);
      aiResponse([
        {
          profileId: profile.id,
          score: 94,
          reason: 'Posiada komputer z GPU.',
          matchedTraits: ['Komputer z GPU'],
        },
      ]);
      const result = await search(owner);
      const path = `/api/testers/searches/${result.id}`;
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: profile.id })
        .expect(200);
      await saveProfile(owner, {
        resources: ['Tablet bez GPU'],
        bio: 'Nie posiadam już komputera, do testów mogę udostępnić wyłącznie tablet.',
      });
      const reopened = await request(app.getHttpServer())
        .get(path)
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchResponseSchema.parse(reopened.body).data,
      ).toMatchObject({
        matches: [],
        assignedProfileIds: [],
        staleMatchCount: 1,
      });
      const history = await request(app.getHttpServer())
        .get('/api/testers/searches')
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchesResponseSchema.parse(history.body).data.searches,
      ).toEqual([
        expect.objectContaining({
          id: result.id,
          matchCount: 0,
          assignedCount: 0,
        }),
      ]);
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: profile.id })
        .expect(404);
      aiResponse([
        {
          profileId: profile.id,
          score: 90,
          reason: 'Deklaruje tablet do testów.',
          matchedTraits: ['Tablet bez GPU'],
        },
      ]);
      const current = await search(
        owner,
        'Szukam osoby z tabletem do testowania aplikacji.',
      );
      expect(current.staleMatchCount).toBe(0);
      expect(current.matches[0]?.profile.resources).toEqual(['Tablet bez GPU']);
    });

    it('invalidates an AI match when its profile changes while the model request is in flight', async () => {
      const owner = newOwner();
      const profile = await saveProfile(owner);
      fetchMock.mockImplementationOnce(async () => {
        await saveProfile(owner, {
          resources: ['Tablet bez GPU'],
          bio: 'Nie posiadam już komputera, do testów mogę udostępnić wyłącznie tablet.',
        });
        return completion([
          {
            profileId: profile.id,
            score: 94,
            reason: 'Posiada komputer z GPU.',
            matchedTraits: ['Komputer z GPU'],
          },
        ]);
      });
      const result = await search(owner);
      expect(result).toMatchObject({
        matches: [],
        assignedProfileIds: [],
        staleMatchCount: 1,
      });
      await request(app.getHttpServer())
        .post(`/api/testers/searches/${result.id}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: profile.id })
        .expect(404);
    });

    it('opens legacy stored matches without profile versions as stale results', async () => {
      const owner = newOwner();
      const profile = await saveProfile(owner);
      const legacyMatches = [
        {
          profileId: profile.id,
          score: 94,
          reason: 'Posiada komputer z GPU.',
          matchedTraits: ['Komputer z GPU'],
        },
      ];
      aiResponse(legacyMatches);
      const result = await search(owner);
      await database.testerSearch.update({
        where: { id: result.id },
        data: { matches: legacyMatches },
      });
      const path = `/api/testers/searches/${result.id}`;
      const restored = await request(app.getHttpServer())
        .get(path)
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchResponseSchema.parse(restored.body).data,
      ).toMatchObject({
        matches: [],
        assignedProfileIds: [],
        staleMatchCount: 1,
      });
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', owner)
        .send({ profileId: profile.id })
        .expect(404);
    });

    it('isolates owner searches and persists idempotent assignments across an application restart', async () => {
      const owner = newOwner();
      const stranger = newOwner();
      const profile = await saveProfile(owner);
      aiResponse([
        {
          profileId: profile.id,
          score: 90,
          reason: 'Posiada wymagany komputer.',
          matchedTraits: ['Komputer z GPU'],
        },
      ]);
      const result = await search(owner);
      const path = `/api/testers/searches/${result.id}`;
      await request(app.getHttpServer())
        .get(path)
        .set('X-Tester-Key', stranger)
        .expect(404);
      await request(app.getHttpServer())
        .post(`${path}/assignments`)
        .set('X-Tester-Key', stranger)
        .send({ profileId: profile.id })
        .expect(404);
      const otherHistory = await request(app.getHttpServer())
        .get('/api/testers/searches')
        .set('X-Tester-Key', stranger)
        .expect(200);
      expect(
        TesterSearchesResponseSchema.parse(otherHistory.body).data.searches,
      ).toEqual([]);
      for (let attempt = 0; attempt < 2; attempt++) {
        const assigned = await request(app.getHttpServer())
          .post(`${path}/assignments`)
          .set('X-Tester-Key', owner)
          .send({ profileId: profile.id })
          .expect(200);
        expect(
          TesterSearchResponseSchema.parse(assigned.body).data
            .assignedProfileIds,
        ).toEqual([profile.id]);
      }
      expect(
        await database.testerAssignment.count({
          where: { searchId: result.id },
        }),
      ).toBe(1);
      await app.close();
      await database.$disconnect();
      app = await startApp();
      const restored = await request(app.getHttpServer())
        .get(path)
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchResponseSchema.parse(restored.body).data.assignedProfileIds,
      ).toEqual([profile.id]);
      const history = await request(app.getHttpServer())
        .get('/api/testers/searches')
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchesResponseSchema.parse(history.body).data.searches,
      ).toEqual([
        expect.objectContaining({
          id: result.id,
          assignedCount: 1,
          matchCount: 1,
        }),
      ]);
      await request(app.getHttpServer())
        .delete(`${path}/assignments/${profile.id}`)
        .set('X-Tester-Key', stranger)
        .expect(404);
      const removed = await request(app.getHttpServer())
        .delete(`${path}/assignments/${profile.id}`)
        .set('X-Tester-Key', owner)
        .expect(200);
      expect(
        TesterSearchResponseSchema.parse(removed.body).data.assignedProfileIds,
      ).toEqual([]);
      expect(
        await database.testerAssignment.count({
          where: { searchId: result.id },
        }),
      ).toBe(0);
    });
  },
);
