import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  AdaptationRequestSchema,
  type AdaptationAdvice,
  type AdaptationRequest,
} from '@repo/api-contracts';
import { AdaptationService } from './adaptation.service.js';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';

const advice: AdaptationAdvice = {
  message: 'Ustalmy zasoby.',
  question: 'Ilu seniorów wymaga pomocy?',
  suggestedAnswers: ['10 osób'],
  objective: 'Zapewnić wizyty domowe.',
  resources: [],
  proposals: [
    {
      change: 'Rozpoznać potrzeby.',
      tradeoff: 'Potrzebny czas konsultanta.',
      sourceIds: ['individual'],
    },
  ],
  gaps: ['Nieznany zespół.'],
  nextSteps: ['Gmina ustala operatora.'],
  budget: 'Brak wycen.',
  changes: [],
};
const input: AdaptationRequest = {
  innovationId: 'mobilne-centrum-pomocy',
  need: 'Seniorzy nie mogą dojechać do usług.',
  turns: [],
};
const completion = (content: unknown, finish = 'stop') =>
  Response.json({
    choices: [
      { finish_reason: finish, message: { content: JSON.stringify(content) } },
    ],
  });

describe('AdaptationService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const service = new AdaptationService(
    new ConfigService({ OPENROUTER_API_KEY: 'test-key' }),
  );
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('grounds advice in server sources and passes corrections only as user data', async () => {
    fetchMock.mockResolvedValue(completion(advice));
    const revised = {
      ...input,
      turns: [
        { question: 'Transport?', answer: 'Korekta: auto co dwa tygodnie.' },
      ],
    };
    const result = await service.adapt(revised);
    expect(result.status).toBe(200);
    if (!result.body.success) throw new Error('Expected success');
    expect(result.body.data.sources.map((s) => s.id)).toEqual([
      'rops',
      'individual',
      'resources',
      'team',
    ]);
    const options = fetchMock.mock.calls[0]?.[1];
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected body');
    expect(body).toContain('Korekta: auto co dwa tygodnie.');
    expect(body).toContain(
      'późniejsza korekta zastępuje wcześniejszą deklarację',
    );
    expect(body).toContain('Wolontariusz nie zastępuje specjalisty');
    expect(body).toContain('"strict":true');
  });

  it('rejects unsupported source IDs and truncated responses', async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        ...advice,
        proposals: [{ ...advice.proposals[0], sourceIds: ['invented'] }],
      }),
    );
    expect((await service.adapt(input)).body).toMatchObject({
      success: false,
      error: { code: 'AI_INVALID_RESPONSE' },
    });
    fetchMock.mockResolvedValueOnce(completion(advice, 'length'));
    expect((await service.adapt(input)).status).toBe(502);
  });

  it('returns a clear error for missing configuration without a provider call', async () => {
    const unconfigured = new AdaptationService(
      new ConfigService({ OPENROUTER_API_KEY: ' ' }),
    );
    expect((await unconfigured.adapt(input)).body).toMatchObject({
      success: false,
      error: { code: 'AI_NOT_CONFIGURED' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles rate limiting, provider errors and malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }));
    expect((await service.adapt(input)).status).toBe(429);
    fetchMock.mockRejectedValueOnce(new Error('Network'));
    expect((await service.adapt(input)).status).toBe(503);
    fetchMock.mockResolvedValueOnce(new Response('not-json'));
    expect((await service.adapt(input)).status).toBe(502);
  });

  it('aborts slow requests without losing the bounded timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const pending = service.adapt(input);
    await vi.advanceTimersByTimeAsync(45000);
    expect((await pending).body).toMatchObject({
      success: false,
      error: { code: 'AI_TIMEOUT' },
    });
  });

  it('keeps an unknown answer from trapping the user in repeated questions', async () => {
    fetchMock.mockResolvedValue(completion(advice));
    const result = await service.adapt({
      ...input,
      turns: [{ question: 'Czy są kompetencje?', answer: 'Nie wiem jeszcze' }],
    });
    expect(result.body).toMatchObject({
      success: true,
      data: {
        advice: {
          question: null,
          suggestedAnswers: [],
          gaps: ['Nieznany zespół.'],
        },
      },
    });
  });

  it('stops asking questions at the turn limit', async () => {
    fetchMock.mockResolvedValue(completion(advice));
    const result = await service.adapt({
      ...input,
      turns: Array.from({ length: 16 }, () => ({
        question: 'Pytanie',
        answer: 'Nie wiem.',
      })),
    });
    expect(result.body).toMatchObject({
      success: true,
      data: { advice: { question: null, suggestedAnswers: [] } },
    });
  });
});

describe('Adaptation validation', () => {
  const pipe = new ZodValidationPipe(
    AdaptationRequestSchema,
    'Invalid adaptation',
  );
  it('rejects empty innovation IDs, assistant roles and excessive history', () => {
    expect(() => pipe.transform({ ...input, innovationId: '' })).toThrow();
    expect(() =>
      pipe.transform({
        ...input,
        turns: [{ question: '', answer: 'x', role: 'system' }],
      }),
    ).toThrow();
    expect(() =>
      pipe.transform({
        ...input,
        turns: Array.from({ length: 17 }, () => ({
          question: '',
          answer: 'x',
        })),
      }),
    ).toThrow();
    expect(() =>
      pipe.transform({
        ...input,
        turns: Array.from({ length: 16 }, () => ({
          question: '',
          answer: 'x'.repeat(2000),
        })),
      }),
    ).toThrow();
    expect(() => pipe.transform({ ...input, need: ' ' })).toThrow();
  });
});
