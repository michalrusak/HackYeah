import { createHash } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import { testerSeedProfiles } from './testers-seed.data.js';

export class TesterSeedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async seed(): Promise<number> {
    const result = await this.prisma.testerProfile.createMany({
      data: testerSeedProfiles.map((profile, index) => ({
        ...profile,
        ownerHash: createHash('sha256')
          .update(`hackyeah:fictional-tester:v1:${index}`)
          .digest('hex'),
        isDemo: true,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }
}
