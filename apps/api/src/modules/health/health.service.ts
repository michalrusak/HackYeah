import { Inject, Injectable, Optional } from '@nestjs/common';
import { createApiSuccess, type HealthData } from '@repo/api-contracts';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma: PrismaService | null,
  ) {}

  async getHealth() {
    let database: HealthData['database'] = 'down';

    if (this.prisma) {
      try {
        await this.prisma.$queryRawUnsafe('SELECT 1');
        database = 'up';
      } catch {
        database = 'down';
      }
    }

    const data: HealthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    };

    return createApiSuccess(data);
  }
}
