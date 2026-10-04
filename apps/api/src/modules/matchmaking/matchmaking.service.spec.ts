import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeRepository } from '../knowledge/knowledge.repository.js';
import { CatalogRepository } from './catalog.repository.js';
import { MatchmakingService } from './matchmaking.service.js';
import { OpenRouterService } from './openrouter.service.js';

const interpretation = {
  summary: 'Młodzież w kryzysie psychicznym potrzebuje wsparcia.',
  audiences: ['Dzieci, młodzież i rodzina'],
  areas: ['Zdrowie psychiczne'],
  needs: ['Wsparcie emocjonalne'],
  missingInformation: [],
};

async function create(recordNeed: () => Promise<void>) {
  const module = await Test.createTestingModule({
    providers: [
      MatchmakingService,
      {
        provide: OpenRouterService,
        useValue: { interpret: async () => interpretation },
      },
      {
        provide: CatalogRepository,
        useValue: {
          snapshot: async () => ({
            innovations: [],
            information: [],
            metadata: { version: 1, innovationCount: 0 },
          }),
        },
      },
      { provide: KnowledgeRepository, useValue: { recordNeed } },
    ],
  }).compile();
  return module.get(MatchmakingService);
}

describe('MatchmakingService need signals', () => {
  it('records only recognised categories, never the description', async () => {
    const recordNeed = vi.fn(async () => undefined);
    const service = await create(recordNeed);
    await service.match('Opis z prywatnymi szczegółami', [], true);
    expect(recordNeed).toHaveBeenCalledTimes(1);
    expect(recordNeed).toHaveBeenCalledWith(
      { areas: ['Zdrowie psychiczne'], needs: ['Wsparcie emocjonalne'] },
      expect.any(Date),
      'matchmaking',
    );
  });

  it('does not record other callers and survives a failed write', async () => {
    const recordNeed = vi.fn(async () => {
      throw new Error('database unavailable');
    });
    const service = await create(recordNeed);
    expect((await service.match('Opis fiszki')).status).toBe(200);
    expect(recordNeed).not.toHaveBeenCalled();
    expect((await service.match('Opis problemu', [], true)).status).toBe(200);
  });
});
