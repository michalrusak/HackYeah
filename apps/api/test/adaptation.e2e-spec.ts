import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiSuccess, type AdaptationData } from '@repo/api-contracts';
import request from 'supertest';
import { AdaptationModule } from '../src/modules/adaptation/adaptation.module.js';
import { AdaptationService } from '../src/modules/adaptation/adaptation.service.js';

describe('POST /api/adaptations', () => {
  let app: INestApplication;
  const adapt = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AdaptationModule],
    })
      .overrideProvider(AdaptationService)
      .useValue({ adapt })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => adapt.mockReset());
  afterAll(async () => {
    await app.close();
  });
  const input = {
    innovationId: 'mobilne-centrum-pomocy',
    need: 'Potrzeba wizyt domowych.',
    turns: [],
  };

  it('returns advice in the standard response envelope', async () => {
    const data: AdaptationData = {
      advice: {
        message: 'Ustalmy zasoby.',
        question: 'Ilu uczestników?',
        suggestedAnswers: [],
        objective: 'Wizyty domowe.',
        resources: [],
        proposals: [],
        gaps: ['Brak diagnozy.'],
        nextSteps: ['Rozpoznaj potrzeby.'],
        budget: 'Nieznany.',
        changes: [],
      },
      sources: [{ id: 'rops', label: 'ROPS', url: 'https://rops.krakow.pl/' }],
    };
    adapt.mockResolvedValue({ status: 200, body: createApiSuccess(data) });
    const response = await request(app.getHttpServer())
      .post('/api/adaptations')
      .send(input)
      .expect(200);
    expect(response.body).toEqual(createApiSuccess(data));
    expect(adapt).toHaveBeenCalledWith(input);
  });

  it('rejects another innovation before calling AI', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/adaptations')
      .send({ ...input, innovationId: 'unknown' })
      .expect(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(adapt).not.toHaveBeenCalled();
  });

  it('preserves the provider error HTTP status and envelope', async () => {
    const body = {
      success: false,
      error: { code: 'AI_TIMEOUT', message: 'Timeout' },
    };
    adapt.mockResolvedValue({ status: 504, body });
    const response = await request(app.getHttpServer())
      .post('/api/adaptations')
      .send(input)
      .expect(504);
    expect(response.body).toEqual(body);
  });
});
