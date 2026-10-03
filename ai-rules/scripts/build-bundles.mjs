#!/usr/bin/env node

/**
 * Merges playbooks into bundles/*.md
 * Run: node ai-rules/scripts/build-bundles.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLAYBOOKS = join(ROOT, 'playbooks');
const BUNDLES = join(ROOT, 'bundles');

const BUNDLE_MAP = {
  'core.md': ['01-global.md', '02-infra.md'],
  'backend.md': ['00-scaffold.md', '01-global.md', '02-infra.md', '03-api.md'],
  'frontend-angular.md': ['00-scaffold-web.md', '01-global.md', '05-web-angular.md'],
  'full.md': [
    '00-scaffold.md',
    '00-scaffold-web.md',
    '01-global.md',
    '02-infra.md',
    '03-api.md',
    '05-web-angular.md',
  ],
};

function readPlaybook(filename) {
  return readFileSync(join(PLAYBOOKS, filename), 'utf-8');
}

function buildBundle(name, files) {
  const header = [
    `# Bundle: ${name}`,
    '',
    '> Auto-generated from `playbooks/`. Edit playbooks, then rebuild.',
    '> Run: `node ai-rules/scripts/build-bundles.mjs`',
    '',
    '---',
    '',
  ].join('\n');

  const body = files.map((f) => readPlaybook(f)).join('\n\n---\n\n');
  return header + body;
}

mkdirSync(BUNDLES, { recursive: true });

for (const [bundleName, files] of Object.entries(BUNDLE_MAP)) {
  writeFileSync(join(BUNDLES, bundleName), buildBundle(bundleName, files));
  console.log(`✓ bundles/${bundleName} (${files.length} playbooks)`);
}

console.log('\nDone.');
