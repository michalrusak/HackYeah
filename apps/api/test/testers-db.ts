import { randomUUID } from 'node:crypto';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateTesters1791000000000 } from '../src/database/migrations/1791000000000-create-testers.js';
import {
  TesterAssignmentEntity,
  TesterProfileEntity,
  TesterSearchEntity,
} from '../src/modules/testers/testers.entities.js';

export async function createTestersDatabase(
  url: string,
): Promise<TypeOrmModuleOptions> {
  const schema = `testers_e2e_${randomUUID().replaceAll('-', '')}`;
  const connection = new DataSource({ type: 'postgres', url });
  await connection.initialize();
  try {
    await connection.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await connection.destroy();
  }

  // Every run owns a new schema. Migrations and cleanup never touch public.
  return {
    type: 'postgres',
    url,
    schema,
    extra: { options: `-c search_path=${schema}` },
    entities: [TesterProfileEntity, TesterSearchEntity, TesterAssignmentEntity],
    migrations: [CreateTesters1791000000000],
    migrationsRun: true,
    synchronize: false,
    retryAttempts: 0,
  };
}
