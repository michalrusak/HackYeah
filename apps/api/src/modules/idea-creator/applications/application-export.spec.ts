import type { GrantCall, IdeaSummary } from '@repo/api-contracts';
import { describe, expect, it } from 'vitest';
import { buildApplicationExport } from './application-export.js';

const call: GrantCall = {
  id: 'call-1',
  name: 'Nabór testowy',
  operator: 'Operator testowy',
  description: 'Opis naboru',
  opensAt: '2026-03-01T00:00:00.000Z',
  closesAt: '2026-03-31T00:00:00.000Z',
  budget: '100 000 zł',
  maxGrant: '20 000 zł',
  status: 'open',
  sections: [
    {
      id: 'opis',
      title: 'Opis innowacji',
      question: 'Na czym polega rozwiązanie?',
      help: '',
      maxLength: 1000,
      required: true,
      order: 1,
    },
    {
      id: 'budzet',
      title: 'Budżet',
      question: 'Jakie są koszty?',
      help: '',
      maxLength: 1000,
      required: true,
      order: 2,
    },
  ],
};

const idea: IdeaSummary = {
  id: 'idea-1',
  title: 'Sąsiedzka ławka rozmów',
  essence: 'Oznaczone ławki dla osób otwartych na rozmowę.',
  targetAudience: 'Seniorzy mieszkający samotnie',
  stage: 'TEST_MIKROSKALA',
  kind: 'IDEA',
  region: 'gmina przykładowa',
  audiences: ['Seniorzy'],
  areas: ['Seniorzy'],
  needs: ['Relacje społeczne'],
  visualId: null,
  visualAltText: null,
  createdAt: '2026-03-02T00:00:00.000Z',
};

describe('buildApplicationExport', () => {
  it('zachowuje kolejność i pytania sekcji naboru', () => {
    const { markdown } = buildApplicationExport(call, idea, {
      opis: 'Ustawiamy cztery ławki.',
      budzet: 'Tabliczki i szkolenie wolontariuszy.',
    });
    expect(markdown.indexOf('## Opis innowacji')).toBeLessThan(
      markdown.indexOf('## Budżet'),
    );
    expect(markdown).toContain('_Na czym polega rozwiązanie?_');
    expect(markdown).toContain('Ustawiamy cztery ławki.');
  });

  it('oznacza puste sekcje jako do uzupełnienia', () => {
    const { markdown } = buildApplicationExport(call, idea, {
      opis: '   ',
    });
    expect(markdown).toContain('_(do uzupełnienia)_');
  });

  it('buduje nazwę pliku z polskich znaków bez diakrytyków', () => {
    const { filename } = buildApplicationExport(call, idea, {});
    expect(filename).toBe('wniosek-sasiedzka-lawka-rozmow.md');
  });
});
