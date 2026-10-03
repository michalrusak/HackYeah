import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorCodes,
  TesterProfileSchema,
  type TesterAiResult,
} from '@repo/api-contracts';
import { TestersAiService } from './testers-ai.service.js';

const profile = TesterProfileSchema.parse({
  id: '07f94cbe-5ef0-4c86-bf8b-9c0c03a27702',
  displayName: 'Tester',
  city: 'Kraków',
  bio: 'Mam mocny komputer i chętnie testuję aplikacje edukacyjne.',
  skills: ['Python'],
  resources: ['RTX 4090'],
  accessibilityNeeds: '',
  interests: ['Edukacja'],
  availability: 'remote',
  consent: true,
  isActive: true,
  isDemo: true,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
});
const result: TesterAiResult = {
  summary: 'Poszukiwana osoba z mocnym komputerem.',
  matches: [
    {
      profileId: profile.id,
      score: 94,
      reason: 'Posiada kartę RTX 4090.',
      matchedTraits: ['RTX 4090'],
    },
  ],
};
function completion(content: unknown = result): object {
  return {
    choices: [
      { finish_reason: 'stop', message: { content: JSON.stringify(content) } },
    ],
  };
}

describe('TestersAiService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const service = new TestersAiService(
    new ConfigService({
      OPENROUTER_API_KEY: 'private-test-key',
      OPENROUTER_MODEL: 'test-model',
    }),
  );
  const telemetry: unknown[] = [];
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    telemetry.length = 0;
    vi.spyOn(Logger.prototype, 'log').mockImplementation((event: unknown) => {
      telemetry.push(event);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('uses configured AI with declared profile data and a closed list of IDs', async () => {
    fetchMock.mockResolvedValue(Response.json(completion()));
    expect(
      await service.match('Potrzebuję mocnego komputera.', [profile]),
    ).toEqual(result);
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON body');
    expect(body).toContain('test-model');
    expect(body).toContain('RTX 4090');
    expect(body).toContain(profile.id);
    expect(body).not.toContain('displayName');
    expect(body).not.toContain('ownerHash');
    expect(body).not.toContain('private-test-key');
    const logs = JSON.stringify(telemetry);
    expect(logs).not.toContain('Potrzebuję mocnego komputera');
    expect(logs).not.toContain('RTX 4090');
    expect(logs).not.toContain('private-test-key');
  });

  it('rejects fabricated IDs and duplicate matches', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        completion({
          ...result,
          matches: [
            {
              ...result.matches[0],
              profileId: '0ce6ba04-aa1f-43bb-a92a-4a6970ed99f4',
            },
          ],
        }),
      ),
    );
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
    fetchMock.mockResolvedValueOnce(
      Response.json(
        completion({
          ...result,
          matches: [...result.matches, ...result.matches],
        }),
      ),
    );
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
  });

  it.each([
    { ...result, matches: [{ ...result.matches[0], score: 150 }] },
    { ...result, matches: [{ ...result.matches[0], matchedTraits: [] }] },
    { ...result, extra: 'prompt injection' },
  ])('rejects invalid AI content', async (content) => {
    fetchMock.mockResolvedValue(Response.json(completion(content)));
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
      status: 502,
    });
  });

  it('rejects malformed JSON and truncated completion', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        choices: [{ finish_reason: 'length', message: { content: '{}' } }],
      }),
    );
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_INVALID_RESPONSE,
    });
  });

  it.each([401, 402, 429, 500])(
    'maps provider status %i without a fake fallback',
    async (status) => {
      fetchMock.mockResolvedValue(new Response('provider details', { status }));
      await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject(
        {
          code:
            status === 429 ? ErrorCodes.RATE_LIMIT : ErrorCodes.AI_UNAVAILABLE,
          status: status === 429 ? 429 : 503,
        },
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('does not call AI when no active profiles exist', async () => {
    expect((await service.match('Wymaganie', [])).matches).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports missing configuration and network errors', async () => {
    await expect(
      new TestersAiService(new ConfigService()).match('Wymaganie', [profile]),
    ).rejects.toMatchObject({ code: ErrorCodes.AI_NOT_CONFIGURED });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValue(new Error('Network details'));
    await expect(service.match('Wymaganie', [profile])).rejects.toMatchObject({
      code: ErrorCodes.AI_UNAVAILABLE,
    });
  });

  it('aborts a slow provider request after thirty seconds', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const assertion = expect(
      service.match('Wymaganie', [profile]),
    ).rejects.toMatchObject({ code: ErrorCodes.AI_TIMEOUT, status: 504 });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
});
