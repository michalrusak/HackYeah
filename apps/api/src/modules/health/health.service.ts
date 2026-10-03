import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createApiSuccess, type HealthData } from '@repo/api-contracts';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @InjectDataSource()
    private readonly dataSource: DataSource | null,
  ) {}

  async getHealth() {
    let database: HealthData['database'] = 'down';

    if (!this.dataSource) {
      return createApiSuccess({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database,
      });
    }

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    const data: HealthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    };

    return createApiSuccess(data);
  }
}
