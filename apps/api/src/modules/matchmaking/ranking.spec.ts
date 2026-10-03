import {
  InnovationCatalogSchema,
  NeedSchema,
  type Innovation,
  type Interpretation,
} from '@repo/api-contracts';
import catalog from './catalog.v1.json' with { type: 'json' };
import { rankInnovations } from './ranking.js';
import { matchInformation } from './ranking.js';
import { InformationCatalogSchema } from '@repo/api-contracts';
import information from './information.v1.json' with { type: 'json' };

const innovations = InnovationCatalogSchema.parse(catalog).innovations;
const interpretation: Interpretation = {
  summary: 'Samotni seniorzy potrzebują relacji i aktywności.',
  audiences: ['Seniorzy'],
  areas: ['Seniorzy'],
  needs: ['Relacje społeczne', 'Aktywizacja społeczna'],
  missingInformation: [],
};
const fixture: Innovation = {
  id: 'fixture',
  name: 'Przykład',
  description: 'Opis',
  audiences: ['Seniorzy'],
  areas: ['Seniorzy'],
  needs: ['Relacje społeczne'],
  sourceUrl: innovations[0].sourceUrl,
  verifiedAt: '2026-10-03',
};

describe('rankInnovations', () => {
  it('weights need, audience and area coverage at 50/30/20', () => {
    expect(rankInnovations(interpretation, [fixture])[0].score).toBe(75);
  });

  it('normalizes omitted dimensions and deduplicates recognized tags', () => {
    expect(
      rankInnovations({ ...interpretation, audiences: [] }, [fixture])[0].score,
    ).toBe(64.29);
    expect(
      rankInnovations({ ...interpretation, audiences: [], areas: [] }, [
        fixture,
      ])[0].score,
    ).toBe(50);
    expect(
      rankInnovations(
        {
          ...interpretation,
          needs: ['Relacje społeczne', 'Relacje społeczne'],
        },
        [fixture],
      )[0].score,
    ).toBe(100);
  });

  it('never recommends innovations without a shared need', () => {
    expect(
      rankInnovations({ ...interpretation, needs: [] }, innovations),
    ).toEqual([]);
    expect(
      rankInnovations({ ...interpretation, needs: ['Prawa konsumenta'] }, [
        fixture,
      ]),
    ).toEqual([]);
  });

  it('sorts ties by id and returns at most five results', () => {
    const copies = ['f', 'b', 'e', 'a', 'd', 'c'].map((id) => ({
      ...fixture,
      id,
    }));
    expect(
      rankInnovations(interpretation, copies).map((match) => match.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('uses the 70 and 40 point boundaries', () => {
    const tenNeeds = {
      ...interpretation,
      needs: NeedSchema.options.slice(0, 10),
    };
    const needs = tenNeeds.needs.slice(0, 8);
    const noCategories = {
      ...fixture,
      needs,
      areas: ['Ubóstwo'],
    } satisfies Innovation;
    expect(rankInnovations(tenNeeds, [noCategories])[0]).toMatchObject({
      score: 70,
      level: 'high',
    });
    expect(
      rankInnovations(tenNeeds, [
        { ...noCategories, needs: needs.slice(0, 2) },
      ])[0],
    ).toMatchObject({
      score: 40,
      level: 'medium',
    });
    expect(
      rankInnovations(tenNeeds, [
        { ...noCategories, needs: needs.slice(0, 1) },
      ])[0].level,
    ).toBe('partial');
  });

  it('excludes innovations for a different audience even when generic needs coincide', () => {
    const input: Interpretation = {
      ...interpretation,
      audiences: ['Cudzoziemcy'],
      areas: ['Integracja cudzoziemców'],
      needs: ['Dostęp do usług', 'Informacja o opiece zdrowotnej'],
    };
    const matches = rankInnovations(input, innovations);
    expect(matches[0].id).toBe('health-guide-pl');
    expect(
      matches.every((item) => item.audiences.includes('Cudzoziemcy')),
    ).toBe(true);
    expect(matches.some((item) => item.id === 'e-rzecznik')).toBe(false);
  });

  it('returns only catalogue data and explanations backed by common tags', () => {
    for (const match of rankInnovations(interpretation, innovations)) {
      const source = innovations.find((item) => item.id === match.id);
      expect(match.sourceUrl).toBe(source?.sourceUrl);
      expect(match.name).toBe(source?.name);
      for (const need of match.matchedNeeds) {
        expect(interpretation.needs).toContain(need);
        expect(source?.needs).toContain(need);
        expect(match.explanation).toContain(need);
      }
    }
  });

  it('has 15 unique, sourced records and all three demo targets in the first three', () => {
    expect(innovations).toHaveLength(15);
    expect(new Set(innovations.map((item) => item.id)).size).toBe(15);
    const cases: { input: Interpretation; expected: string }[] = [
      { input: interpretation, expected: 'senior-cuder' },
      {
        input: {
          ...interpretation,
          audiences: ['Cudzoziemcy'],
          areas: ['Integracja cudzoziemców', 'Zdrowie'],
          needs: [
            'Informacja o opiece zdrowotnej',
            'Dostęp do usług',
            'Dostępna komunikacja',
          ],
        },
        expected: 'health-guide-pl',
      },
      {
        input: {
          ...interpretation,
          audiences: ['Dzieci, młodzież i rodzina'],
          areas: ['Zdrowie psychiczne'],
          needs: [
            'Powrót do szkoły',
            'Psychoedukacja',
            'Wsparcie emocjonalne',
            'Relacje społeczne',
          ],
        },
        expected: 'bez-presji-z-depresji',
      },
    ];
    for (const example of cases) {
      expect(
        rankInnovations(example.input, innovations)
          .slice(0, 3)
          .map((item) => item.id),
      ).toContain(example.expected);
    }
  });
});

describe('related information', () => {
  const items = InformationCatalogSchema.parse(information).information;
  it('matches verified information and distinguishes national context from regional reports', () => {
    const results = matchInformation(interpretation, items);
    expect(results.map((item) => item.id)).toContain('mapa-seniorzy');
    expect(results.every((item) => item.areas.includes('Seniorzy'))).toBe(true);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results.find((item) => item.id === 'mapa-seniorzy')?.scope).toBe(
      'national',
    );
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
  it('does not return forced information for an unrecognized problem', () => {
    expect(
      matchInformation({ ...interpretation, needs: [], areas: [] }, items),
    ).toEqual([]);
  });
  it('still supplies context when an area has no matching innovation', () => {
    const input: Interpretation = {
      ...interpretation,
      audiences: ['Osoby w kryzysie bezdomności'],
      needs: [],
      areas: ['Bezdomność'],
    };
    expect(rankInnovations(input, innovations)).toEqual([]);
    expect(matchInformation(input, items).map((item) => item.id)).toContain(
      'mapa-bezdomnosc',
    );
  });
});
