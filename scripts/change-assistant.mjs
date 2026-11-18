import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requestFile = resolve(root, 'docs/CHANGE_REQUESTS.md');
const logFile = resolve(root, 'docs/CHANGELOG.md');
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const clean = (x) => (x ?? '').toString().trim().replaceAll('\r', ' ').replaceAll('\n', ' ');
function recordRequest(description, rationale = 'Belum dijelaskan', acceptance = 'Perlu ditentukan') {
  if (!clean(description)) throw new Error('Deskripsi tidak boleh kosong.');
  const id = 'REQ-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  appendFileSync(requestFile, `\n### ${id} — ${clean(description)}\n- Status: OPEN\n- Dibuat: ${now()}\n- Alasan: ${clean(rationale)}\n- Kriteria penerimaan: ${clean(acceptance)}\n`, 'utf8');
  console.log(`Permintaan disimpan: ${id} → docs/CHANGE_REQUESTS.md`);
}
function recordLog(description, files = 'Belum dicatat', testing = 'Belum diuji', risk = 'Perlu review') {
  if (!clean(description)) throw new Error('Deskripsi tidak boleh kosong.');
  appendFileSync(logFile, `\n### ${now()} — ${clean(description)}\n- Tipe: Change\n- Alasan: ${clean(description)}\n- File: ${clean(files)}\n- Pengujian: ${clean(testing)}\n- Catatan: ${clean(risk)}\n`, 'utf8');
  console.log('Perubahan dicatat → docs/CHANGELOG.md');
}
const [command, ...args] = process.argv.slice(2);
if (command === 'request') recordRequest(args.join(' '));
else if (command === 'log') recordLog(args.join(' '));
else if (command === 'list') {
  console.log('PERMINTAAN TERAKHIR\n' + readFileSync(requestFile, 'utf8').slice(-2500));
  console.log('\nPERUBAHAN TERAKHIR\n' + readFileSync(logFile, 'utf8').slice(-2500));
} else if (!command) {
  const rl = createInterface({ input, output });
  try {
    console.log('\n=== USAHACERDAS CHANGE ASSISTANT ===');
    console.log('1. Catat permintaan perubahan\n2. Catat perubahan selesai\n3. Lihat catatan terakhir\n4. Keluar');
    const choice = (await rl.question('Pilih 1-4: ')).trim();
    if (choice === '1') {
      const a = await rl.question('Apa yang ingin diubah? ');
      const b = await rl.question('Mengapa? ');
      const c = await rl.question('Kapan dianggap selesai? ');
      recordRequest(a, b, c);
    } else if (choice === '2') {
      const a = await rl.question('Apa yang sudah diubah? ');
      const b = await rl.question('File yang diubah (pisahkan koma): ');
      const c = await rl.question('Pengujian & hasil (jangan mengarang): ');
      const d = await rl.question('Risiko/hal yang belum selesai: ');
      recordLog(a, b, c, d);
    } else if (choice === '3') {
      console.log('\n' + readFileSync(requestFile,'utf8').slice(-2500));
      console.log('\n' + readFileSync(logFile,'utf8').slice(-2500));
    } else if (choice !== '4') console.log('Pilihan tidak dikenal.');
  } finally { rl.close(); }
} else {
  console.error('Gunakan: npm run assistant | npm run change:request -- "deskripsi" | npm run change:log -- "deskripsi"');
  process.exitCode = 1;
}
