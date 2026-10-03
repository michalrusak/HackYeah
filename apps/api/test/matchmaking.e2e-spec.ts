import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ErrorCodes,
  MatchmakingResponseSchema,
  type Interpretation,
} from '@repo/api-contracts';
import request from 'supertest';
import { MatchmakingModule } from '../src/modules/matchmaking/matchmaking.module.js';
import {
  InterpretationError,
  OpenRouterService,
} from '../src/modules/matchmaking/openrouter.service.js';

const interpretation: Interpretation = {
  summary: 'Wsparcie powrotu uczniów do szkoły.',
  audiences: ['Dzieci, młodzież i rodzina'],
  areas: ['Zdrowie psychiczne'],
  needs: ['Powrót do szkoły', 'Psychoedukacja'],
  missingInformation: [],
};

describe('POST /api/matchmaking', () => {
  let app: INestApplication;
  const interpret = vi.fn<(description: string) => Promise<Interpretation>>();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [MatchmakingModule],
    })
      .overrideProvider(OpenRouterService)
      .useValue({ interpret })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => {
    interpret.mockReset();
    interpret.mockResolvedValue(interpretation);
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns the shared envelope with the expected innovation and a catalogue URL', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/matchmaking')
      .send({ description: '  Uczniowie wracają do szkoły po terapii.  ' })
      .expect(200);
    const { data } = MatchmakingResponseSchema.parse(response.body);
    expect(data.matches[0].id).toBe('bez-presji-z-depresji');
    expect(data.matches[0].sourceUrl).toContain(
      'rops.krakow.pl/innowacje-spoleczne/',
    );
    expect(interpret).toHaveBeenCalledWith(
      'Uczniowie wracają do szkoły po terapii.',
    );
  });

  it.each([
    {},
    { description: '' },
    { description: '   ' },
    { description: 42 },
    { description: 'x'.repeat(4001) },
    { description: 'opis', key: 'extra' },
  ])('rejects invalid input before calling AI', async (body) => {
    const response = await request(app.getHttpServer())
      .post('/api/matchmaking')
      .send(body)
      .expect(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: ErrorCodes.VALIDATION_ERROR },
    });
    expect(interpret).not.toHaveBeenCalled();
  });

  it('accepts the 4000 character boundary', async () => {
    await request(app.getHttpServer())
      .post('/api/matchmaking')
      .send({ description: 'x'.repeat(4000) })
      .expect(200);
  });

  it('returns an empty list and clarification for an ambiguous description', async () => {
    interpret.mockResolvedValue({
      ...interpretation,
      needs: [],
      missingInformation: ['Jaka jest główna trudność?'],
    });
    const response = await request(app.getHttpServer())
      .post('/api/matchmaking')
      .send({ description: 'Chcemy pomóc.' })
      .expect(200);
    expect(response.body.data.matches).toEqual([]);
    expect(response.body.data.interpretation.missingInformation).toHaveLength(
      1,
    );
  });

  it.each([
    [ErrorCodes.AI_NOT_CONFIGURED, 503],
    [ErrorCodes.AI_TIMEOUT, 504],
    [ErrorCodes.AI_INVALID_RESPONSE, 502],
    [ErrorCodes.AI_UNAVAILABLE, 503],
    [ErrorCodes.RATE_LIMIT, 429],
  ] as const)('returns a safe error envelope for %s', async (code, status) => {
    interpret.mockRejectedValue(new InterpretationError(code, status));
    const response = await request(app.getHttpServer())
      .post('/api/matchmaking')
      .send({ description: 'Opis problemu.' })
      .expect(status);
    expect(response.body).toMatchObject({ success: false, error: { code } });
    expect(response.body).not.toHaveProperty('stack');
  });
});
