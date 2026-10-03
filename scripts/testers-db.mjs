import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execLocal, waitForExit } from './lib/exec-local.mjs';
import { loadRootEnv } from './lib/load-env.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2];
if (!['migrate', 'seed'].includes(action)) {
  console.error('Usage: node scripts/testers-db.mjs migrate|seed');
  process.exit(1);
}

loadRootEnv();
try {
  await waitForExit(execLocal('pnpm', ['--filter', '@repo/api-contracts', 'build'], { cwd: rootDir }));
  await waitForExit(execLocal('pnpm', ['--filter', 'api', 'build'], { cwd: rootDir }));
  await waitForExit(execLocal(process.execPath, ['apps/api/dist/database/testers-db.cli.js', action], { cwd: rootDir }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database command failed');
  process.exitCode = 1;
}
