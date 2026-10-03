import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HelloResponseSchema,
  HealthResponseSchema,
} from '@repo/api-contracts';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api returns hello envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);

    const parsed = HelloResponseSchema.parse(response.body);
    expect(parsed.data.message).toBe('Hello World!');
  });

  it('GET /api/health returns health envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    const parsed = HealthResponseSchema.parse(response.body);
    expect(parsed.data.status).toBe('ok');
    expect(parsed.data.database).toBe('down');
  });
});
