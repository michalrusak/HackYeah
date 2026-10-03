import { createHash, randomBytes } from 'node:crypto';
import { testerSeedProfiles } from '../src/database/testers-seed.data.js';
import { TesterSeedRepository } from '../src/database/testers-seed.repository.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { connectTestersDatabase, createTestersDatabase } from './testers-db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('Fictional tester seed with PostgreSQL', () => {
  let database: PrismaClient;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
    const schema = await createTestersDatabase(databaseUrl);
    database = connectTestersDatabase(databaseUrl, schema);
    await database.$connect();
  });

  afterAll(async () => {
    if (database) {
      // This client is scoped to the isolated schema created for this test.
      await database.testerProfile.deleteMany();
      await database.$disconnect();
    }
  });

  it('adds all profiles once, preserves existing records and creates no accounts', async () => {
    const first = testerSeedProfiles[0];
    if (!first) throw new Error('Expected seed profiles');
    const existingSeed = await database.testerProfile.create({
      data: {
        ...first,
        ownerHash: createHash('sha256')
          .update('hackyeah:fictional-tester:v1:0')
          .digest('hex'),
        bio: 'Istniejący opis profilu pozostaje bez zmian po ponownym zasileniu bazy.',
        isDemo: true,
      },
    });
    const userProfile = await database.testerProfile.create({
      data: {
        ...first,
        displayName: 'Własny profil użytkownika',
        ownerHash: randomBytes(32).toString('hex'),
        isDemo: false,
      },
    });
    const repository = new TesterSeedRepository(database);

    expect(await repository.seed()).toBe(testerSeedProfiles.length - 1);
    expect(await repository.seed()).toBe(0);
    expect(
      await database.testerProfile.count({ where: { isDemo: true } }),
    ).toBe(testerSeedProfiles.length);
    expect(await database.testerProfile.count()).toBe(
      testerSeedProfiles.length + 1,
    );
    expect(await database.account.count()).toBe(0);
    expect(
      await database.testerProfile.findUnique({
        where: { id: existingSeed.id },
      }),
    ).toEqual(existingSeed);
    expect(
      await database.testerProfile.findUnique({
        where: { id: userProfile.id },
      }),
    ).toEqual(userProfile);
  });
});
