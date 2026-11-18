import { execFileSync } from 'node:child_process';
function git(...args) { return execFileSync('git', args, { encoding:'utf8' }).trim(); }
try {
  const files = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const changedCode = files.some(f => /^(frontend\/|backend\/|scripts\/|package\.json$|docker-compose\.yml$)/.test(f));
  if (changedCode && !files.includes('docs/CHANGELOG.md')) {
    console.error('Perubahan kode terdeteksi tanpa docs/CHANGELOG.md. Catat perubahan sebelum commit.');
    process.exitCode = 1;
  } else console.log('Changelog check: OK');
} catch {
  console.log('Tidak ada Git repository aktif, pemeriksaan changelog dilewati.');
}
