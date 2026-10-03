import { TesterProfileInputSchema } from '@repo/api-contracts';
import { testerSeedProfiles } from './testers-seed.data.js';

describe('Fictional tester dataset', () => {
  it('contains at least 200 distinct, valid public profiles without credentials', () => {
    expect(testerSeedProfiles.length).toBeGreaterThanOrEqual(200);
    expect(
      new Set(testerSeedProfiles.map((profile) => profile.displayName)).size,
    ).toBe(testerSeedProfiles.length);
    expect(new Set(testerSeedProfiles.map((profile) => profile.bio)).size).toBe(
      testerSeedProfiles.length,
    );
    for (const profile of testerSeedProfiles) {
      expect(TesterProfileInputSchema.safeParse(profile).success).toBe(true);
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('login');
      expect(profile).not.toHaveProperty('ownerHash');
    }
  });

  it('retains the original seed positions used by existing database identities', () => {
    expect(
      testerSeedProfiles.slice(0, 10).map((profile) => profile.displayName),
    ).toEqual([
      'Maja Nowak',
      'Kamil Zieliński',
      'Anna Wójcik',
      'Piotr Wiśniewski',
      'Ewa Kamińska',
      'Tomasz Lewandowski',
      'Oliwia Mazur',
      'Jakub Dąbrowski',
      'Zofia Lis',
      'Michał Król',
    ]);
  });

  it('covers equipment, accessibility, digital skills and local social needs', () => {
    const text = testerSeedProfiles
      .map((profile) => JSON.stringify(profile))
      .join(' ');
    for (const term of [
      'czujnik',
      'RTX 4090',
      'NVDA',
      'wózku',
      '72 lata',
      'rzadko korzystam z komputera',
      'wolontariatu',
      'wiejskie',
    ]) {
      expect(text).toContain(term);
    }
    expect(
      new Set(testerSeedProfiles.map((profile) => profile.city)).size,
    ).toBeGreaterThanOrEqual(50);
    expect(
      new Set(testerSeedProfiles.map((profile) => profile.availability)),
    ).toEqual(new Set(['remote', 'onsite', 'hybrid']));
    const withNeeds = testerSeedProfiles.filter(
      (profile) => profile.accessibilityNeeds.length > 0,
    );
    expect(withNeeds.length).toBeGreaterThan(30);
    expect(withNeeds.length).toBeLessThan(testerSeedProfiles.length / 2);
  });
});
