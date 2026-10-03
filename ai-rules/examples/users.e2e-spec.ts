// apps/api-nest/test/users.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase } from './helpers/test-app';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await cleanDatabase(app);
  });

  describe('POST /api/v1/users', () => {
    it('returns 201 with user data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'alice@hackyeah.local', name: 'Alice' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe('alice@hackyeah.local');
          expect(res.body.data.id).toBeDefined();
        });
    });

    it('returns 400 on invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'not-an-email', name: 'Alice' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details?.email).toBeDefined();
        });
    });

    it('returns 409 on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'dup@hackyeah.local', name: 'First' })
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'dup@hackyeah.local', name: 'Second' })
        .expect(409)
        .expect((res) => {
          expect(res.body.error.code).toBe('EMAIL_TAKEN');
        });
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns 404 when user not found', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/nonexistent-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('USER_NOT_FOUND');
        });
    });
  });
});
