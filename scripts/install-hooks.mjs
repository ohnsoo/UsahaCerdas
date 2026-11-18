import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = resolve(root, '.git');
if (!existsSync(gitDir)) {
  console.error('Inisialisasi Git terlebih dahulu: git init'); process.exit(1);
}
const hooks = resolve(gitDir, 'hooks'); mkdirSync(hooks, { recursive: true });
const hook = resolve(hooks, 'pre-commit');
if (existsSync(hook)) {
  console.error('Hook pre-commit sudah ada. Tidak menimpa hook pengguna.'); process.exit(1);
}
writeFileSync(hook, '#!/bin/sh\nnode scripts/check-changelog.mjs\n', { mode: 0o755 });
console.log('Pre-commit changelog hook berhasil diinstal.');
