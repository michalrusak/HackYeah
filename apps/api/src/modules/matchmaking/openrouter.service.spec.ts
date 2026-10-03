import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes, type Interpretation } from '@repo/api-contracts';
import { OpenRouterService } from './openrouter.service.js';

const interpretation: Interpretation = {
  summary: 'Samotni seniorzy potrzebują wspólnych zajęć.',
  audiences: ['Seniorzy'],
  areas: ['Seniorzy'],
  needs: ['Relacje społeczne'],
  missingInformation: [],
};
const responseBody = (content: unknown = interpretation): object => ({
  choices: [
    { finish_reason: 'stop', message: { content: JSON.stringify(content) } },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
});

describe('OpenRouterService', () => {
  const service = new OpenRouterService(
    new ConfigService({ OPENROUTER_API_KEY: 'test-secret' }),
  );
  const fetchMock = vi.fn<typeof fetch>();
  const telemetry: unknown[] = [];

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    telemetry.length = 0;
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      telemetry.push(message);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('makes one server request with the configured model and strict closed vocabulary', async () => {
    fetchMock.mockResolvedValue(Response.json(responseBody()));
    expect(await service.interpret('Opis prywatny')).toEqual(interpretation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options?.headers).toEqual({
      Authorization: 'Bearer test-secret',
      'Content-Type': 'application/json',
    });
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON request body');
    const request = JSON.parse(body);
    expect(request).toMatchObject({
      model: 'qwen/qwen3.8-27b',
      stream: false,
      provider: { require_parameters: true, allow_fallbacks: false },
    });
    expect(request.response_format.json_schema.strict).toBe(true);
    const log = JSON.stringify(telemetry);
    expect(log).toContain('total_tokens');
    expect(log).not.toContain('Opis prywatny');
    expect(log).not.toContain('test-secret');
    expect(log).not.toContain(interpretation.summary);
  });

  it('uses an explicitly configured model', async () => {
    fetchMock.mockResolvedValue(Response.json(responseBody()));
    await new OpenRouterService(
      new ConfigService({
        OPENROUTER_API_KEY: 'key',
        OPENROUTER_MODEL: 'custom-model',
      }),
    ).interpret('Opis');
    const body = fetchMock.mock.calls[0][1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON request body');
    expect(JSON.parse(body).model).toBe('custom-model');
  });

  it('deduplicates recognized tags', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        responseBody({
          ...interpretation,
          needs: ['Relacje społeczne', 'Relacje społeczne'],
        }),
      ),
    );
    expect((await service.interpret('Opis')).needs).toEqual([
      'Relacje społeczne',
    ]);
  });

  it.each([
    { ...interpretation, needs: ['Nieznany tag'] },
    { ...interpretation, sourceUrl: 'https://invented.example' },
    { ...interpretation, summary: '' },
    { summary: 'Brakuje pól' },
  ])(
    'rejects invalid schema data without leaking the response',
    async (content) => {
      fetchMock.mockResolvedValue(Response.json(responseBody(content)));
      await expect(service.interpret('Opis')).rejects.toMatchObject({
        code: ErrorCodes.AI_INVALID_RESPONSE,
        status: 502,
      });
    },
  );

  it('rejects malformed JSON and truncated completions', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        choices: [{ finish_reason: 'stop', message: { content: '{invalid' } }],
      }),
    );
    await expect(service.interpret('Opis')).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        choices: [{ finish_reason: 'length', message: { content: '{}' } }],
      }),
    );
    await expect(service.interpret('Opis')).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(service.interpret('Opis')).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
  });

  it.each([401, 402, 429, 500, 503])(
    'maps upstream HTTP %i with no retry',
    async (status) => {
      fetchMock.mockResolvedValue(new Response('upstream details', { status }));
      await expect(service.interpret('Opis')).rejects.toMatchObject({
        code:
          status === 429 ? ErrorCodes.RATE_LIMIT : ErrorCodes.AI_UNAVAILABLE,
        status: status === 429 ? 429 : 503,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('handles a missing key without making a request', async () => {
    await expect(
      new OpenRouterService(new ConfigService()).interpret('Opis'),
    ).rejects.toMatchObject({ code: ErrorCodes.AI_NOT_CONFIGURED });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network details'));
    await expect(service.interpret('Opis')).rejects.toMatchObject({
      code: ErrorCodes.AI_UNAVAILABLE,
    });
  });

  it('aborts after 30 seconds and does not retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const assertion = expect(service.interpret('Opis')).rejects.toMatchObject({
      code: ErrorCodes.AI_TIMEOUT,
      status: 504,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('passes clarification history as user data and keeps it out of logs', async () => {
    fetchMock.mockResolvedValue(Response.json(responseBody()));
    const answers = [
      { question: 'Kto?', answer: 'Prywatna odpowiedź seniorów' },
    ];
    await service.interpret('Pierwotny opis', answers);
    const body = fetchMock.mock.calls[0][1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON');
    const payload = JSON.parse(body);
    expect(JSON.parse(payload.messages[1].content)).toEqual({
      description: 'Pierwotny opis',
      answers,
    });
    expect(payload.messages[0].content).toContain('Nie pytaj ponownie');
    expect(JSON.stringify(telemetry)).not.toContain(answers[0].answer);
  });
});
