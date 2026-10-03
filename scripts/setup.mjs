import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');
const examplePath = path.join(rootDir, '.env.example');

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.warn('[setup] Brak .env.example — pomiń tworzenie .env');
    process.exit(0);
  }

  copyFileSync(examplePath, envPath);
  console.log('[setup] Utworzono .env z .env.example');
}
