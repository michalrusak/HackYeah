import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getDatabaseConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const synchronize = config.get<string>('NODE_ENV') !== 'production';
  const databaseUrl = config.get<string>('DATABASE_URL');

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      synchronize,
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
    synchronize,
  };
}
