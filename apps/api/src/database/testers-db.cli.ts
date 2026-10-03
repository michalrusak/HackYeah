import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { TesterSeedRepository } from './testers-seed.repository.js';

async function main(): Promise<void> {
  if (process.argv[2] !== 'seed')
    throw new Error(
      'Użycie: testers-db.cli.js seed. Migracje: pnpm db:migrate.',
    );
  const envPath = [resolve('.env'), resolve('../../.env')].find((path) =>
    existsSync(path),
  );
  if (envPath) loadEnvFile(envPath);
  const prisma = new PrismaService(new ConfigService(process.env));
  await prisma.onModuleInit();
  try {
    const inserted = await new TesterSeedRepository(prisma).seed();
    console.log(
      `Dodane fikcyjne profile przykładowe: ${inserted}. Istniejące profile zachowano.`,
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Nie udało się zasilić bazy testerów.',
  );
  process.exitCode = 1;
});
