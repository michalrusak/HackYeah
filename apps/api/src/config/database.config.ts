import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CreateTesters1791000000000 } from '../database/migrations/1791000000000-create-testers.js';

export function getDatabaseConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const migrationOptions = {
    synchronize: false,
    migrationsRun: false,
    migrations: [CreateTesters1791000000000],
  };
  const databaseUrl = config.get<string>('DATABASE_URL');

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      ...migrationOptions,
    };
  }

  return {
    type: 'postgres',
    host: config.get<string>('POSTGRES_HOST', 'localhost'),
    port: config.get<number>('POSTGRES_PORT', 5432),
    username: config.get<string>('POSTGRES_USER', 'hackyeah'),
    password: config.get<string>('POSTGRES_PASSWORD', 'hackyeah'),
    database: config.get<string>('POSTGRES_DB', 'hackyeah'),
    autoLoadEntities: true,
    ...migrationOptions,
  };
}
