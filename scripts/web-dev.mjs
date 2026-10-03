import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execLocal, waitForExit } from './lib/exec-local.mjs';
import { loadRootEnv } from './lib/load-env.mjs';

loadRootEnv();

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web');
const port = process.env.WEB_PORT ?? '4200';

await waitForExit(
  execLocal('ng', ['serve', '--port', port], { cwd: webRoot }),
);
