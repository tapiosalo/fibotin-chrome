/**
 * Packages the extension into dist/fibotin.zip for Chrome Web Store submission.
 * Excludes all development-only files (tests, docs, node_modules, CI config).
 *
 * Usage: node scripts/package.js
 */
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'dist/fibotin.zip');

mkdirSync(resolve(ROOT, 'dist'), { recursive: true });

// Files/dirs to exclude from the store zip.
const excludes = [
  '.*',         // all hidden files/dirs (.git, .github, .gitignore, .claude, etc.)
  'CLAUDE.md',
  'dist',
  'docs',
  'node_modules',
  'package.json',
  'package-lock.json',
  'scripts',
  'test',
  'vitest.config.js',
];

const flags = excludes
  .flatMap((p) => [`-x "${p}"`, `-x "${p}/*"`])
  .join(' ');

execSync(`cd "${ROOT}" && zip -r "${OUT}" . ${flags}`, { stdio: 'inherit', shell: true });

console.log(`\nPackaged: ${OUT}`);
console.log('Verify the contents with: unzip -l dist/fibotin.zip');
