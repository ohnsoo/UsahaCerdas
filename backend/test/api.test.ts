// Tes integrasi API UsahaCerdas. Menjalankan app di port acak terhadap DATABASE_URL di backend/.env,
// lalu menghapus akun uji yang dibuat (domain @usahacerdas.test) setelah selesai.
// Jalankan: npm test (root) atau npm test -w backend.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app, prisma } from '../src/app.js';

let server: Server;
let BASE = '';
const createdEmails: string[] = [];

type Res = { status: number; data: any };
function client(extraHeaders: Record<string, string> = {}) {
  let cookie = '';
  return async (method: string, path: string, body?: unknown): Promise<Res> => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data };
  };
}

before(async () => {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } });
  const ids = users.map(u => u.id);
  // Business cascade menghapus rekening, kategori, transaksi, dan audit log; baru kemudian user.
  await prisma.business.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  await new Promise(r => server.close(r));
});

const today = new Date().toISOString().slice(0, 10);
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const pw = 'Uji-' + Math.random().toString(36).slice(2) + '-Pw';
const emailA = `uji-a-${stamp}@usahacerdas.test`;
const emailB = `uji-b-${stamp}@usahacerdas.test`;
const A = client(), B = client(), anon = client();

async function register(c: ReturnType<typeof client>, email: string, name: string) {
  createdEmails.push(email);
  return c('POST', '/auth/register', { name, businessName: `Usaha ${name}`, email, password: pw });
}
const dash = async () => (await A('GET', `/reports?from=${today}&to=${today}`)).data;
const balances = (d: any): Record<string, string> => Object.fromEntries(d.accountBalances.map((a: any) => [a.name, a.balance]));

// Data bersama antar tes (berjalan berurutan dalam satu file).
let kas: any, bank: any, catIn: any, catEx: any, inc: any, transfer: any;
const tx = (type: string, amount: string, extra: object) => A('POST', '/transactions', { type, amount, date: today, note: 'uji', ...extra });

describe('autentikasi dan keamanan', () => {
  test('health tanpa login', async () => assert.equal((await anon('GET', '/health')).status, 200));
  test('T04 laporan tanpa login 401', async () => assert.equal((await anon('GET', '/reports')).status, 401));

  test('T01 register membuat Kas Utama + 6 kategori', async () => {
    assert.equal((await register(A, emailA, 'Pemilik Uji A')).status, 201);
    const accounts = (await A('GET', '/accounts')).data;
    const cats = (await A('GET', '/categories')).data;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].name, 'Kas Utama');
    assert.equal(accounts[0].hasTransactions, false);
    assert.equal(accounts[0].archivedAt, null);
    assert.equal(cats.length, 6);
    catIn = cats.find((c: any) => c.type === 'INCOME' && c.name === 'Penjualan');
    catEx = cats.find((c: any) => c.type === 'EXPENSE' && c.name === 'Operasional');
  });
  test('T02 email duplikat 409', async () => {
    assert.equal((await anon('POST', '/auth/register', { name: 'X Y', businessName: 'Usaha X', email: emailA, password: pw })).status, 409);
  });
  test('T03 password salah 401', async () => {
    assert.equal((await anon('POST', '/auth/login', { email: emailA, password: pw + 'x' })).status, 401);
  });
  test('T16 /auth/me dengan sesi', async () => assert.equal((await A('GET', '/auth/me')).status, 200));
  test('Origin asing ditolak 403', async () => {
    const evil = client({ Origin: 'https://evil.example' });
    assert.equal((await evil('POST', '/auth/login', { email: emailA, password: pw })).status, 403);
  });
  test('POST tanpa JSON ditolak 415', async () => {
    const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(r.status, 415);
  });
});

describe('transaksi dan aturan keuangan', () => {
  before(async () => {
    kas = (await A('POST', '/accounts', { name: 'Kas Uji', openingBalance: '1000000' })).data;
    bank = (await A('POST', '/accounts', { name: 'Bank Uji', openingBalance: '0' })).data;
  });

  for (const bad of ['', '0', '-10', 'abc', '1.234']) {
    test(`T06 nominal "${bad}" ditolak 400`, async () => {
      assert.equal((await tx('INCOME', bad, { accountId: kas.id, categoryId: catIn.id })).status, 400);
    });
  }
  test('T07 kategori pengeluaran untuk pemasukan 400', async () => {
    assert.equal((await tx('INCOME', '1000', { accountId: kas.id, categoryId: catEx.id })).status, 400);
  });
  test('T09 transfer ke rekening sama 400', async () => {
    assert.equal((await tx('TRANSFER', '1000', { fromAccountId: kas.id, toAccountId: kas.id })).status, 400);
  });
  test('T11 pemasukan dan pengeluaran mengubah saldo dan surplus', async () => {
    inc = (await tx('INCOME', '500000', { accountId: kas.id, categoryId: catIn.id })).data;
    await tx('EXPENSE', '200000', { accountId: kas.id, categoryId: catEx.id });
    const d = await dash();
    assert.equal(d.cashBalance, '1300000');
    assert.equal(d.operatingSurplus, '300000');
  });
  test('T12 modal dan prive mengubah kas, bukan surplus', async () => {
    await tx('CAPITAL', '1000000', { accountId: kas.id });
    await tx('DRAW', '100000', { accountId: kas.id });
    const d = await dash();
    assert.equal(d.cashBalance, '2200000');
    assert.equal(d.operatingSurplus, '300000');
  });
  test('T13 transfer memindahkan saldo tanpa mengubah total', async () => {
    transfer = (await tx('TRANSFER', '300000', { fromAccountId: kas.id, toAccountId: bank.id })).data;
    const d = await dash();
    assert.deepEqual([balances(d)['Kas Uji'], balances(d)['Bank Uji']], ['1900000', '300000']);
    assert.equal(d.cashBalance, '2200000');
    assert.equal(d.operatingSurplus, '300000');
  });
  test('T10 hapus kategori terpakai 409', async () => {
    assert.equal((await A('DELETE', `/categories/${catIn.id}`)).status, 409);
  });
});

describe('isolasi antar usaha', () => {
  test('T05 owner B tidak bisa mengubah, menghapus, atau melihat transaksi A', async () => {
    await register(B, emailB, 'Pemilik Uji B');
    const put = await B('PUT', `/transactions/${inc.id}`, { type: 'INCOME', amount: '1', date: today, note: 'hack', accountId: kas.id, categoryId: catIn.id });
    assert.equal(put.status, 404);
    assert.equal((await B('DELETE', `/transactions/${inc.id}`)).status, 404);
    assert.equal((await B('GET', '/transactions')).data.length, 0);
  });
  test('T08 owner B memakai rekening A 400', async () => {
    const bCat = (await B('GET', '/categories')).data.find((c: any) => c.type === 'INCOME');
    assert.equal((await B('POST', '/transactions', { type: 'INCOME', amount: '1000', date: today, accountId: kas.id, categoryId: bCat.id })).status, 400);
  });
  test('owner B tidak bisa mengubah rekening A', async () => {
    assert.equal((await B('PATCH', `/accounts/${kas.id}`, { name: 'Dibajak' })).status, 404);
  });
});

describe('kelola rekening', () => {
  test('ubah nama rekening', async () => {
    const r = await A('PATCH', `/accounts/${bank.id}`, { name: 'Bank Uji Baru' });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, 'Bank Uji Baru');
    assert.equal(r.data.hasTransactions, true);
  });
  test('nama rekening duplikat 409', async () => {
    assert.equal((await A('PATCH', `/accounts/${bank.id}`, { name: 'Kas Uji' })).status, 409);
  });
  test('body kosong 400', async () => {
    assert.equal((await A('PATCH', `/accounts/${bank.id}`, {})).status, 400);
  });
  test('saldo awal rekening yang sudah punya transaksi tidak bisa diubah', async () => {
    const r = await A('PATCH', `/accounts/${kas.id}`, { openingBalance: '5000000' });
    assert.equal(r.status, 409);
    assert.match(r.data.error, /Saldo awal tidak bisa diubah/);
    // Mengirim nilai yang sama bukan perubahan, jadi tetap diterima.
    assert.equal((await A('PATCH', `/accounts/${kas.id}`, { openingBalance: '1000000.00' })).status, 200);
  });
  test('saldo awal rekening tanpa transaksi bisa diubah', async () => {
    const fresh = (await A('POST', '/accounts', { name: 'Dompet Uji', openingBalance: '0' })).data;
    const r = await A('PATCH', `/accounts/${fresh.id}`, { openingBalance: '250000' });
    assert.equal(r.status, 200);
    assert.equal(r.data.openingBalance, '250000');
    assert.equal((await dash()).cashBalance, '2450000');
    // Kembalikan ke nol lalu arsipkan agar tidak mengganggu angka tes berikutnya.
    await A('PATCH', `/accounts/${fresh.id}`, { openingBalance: '0' });
    assert.equal((await A('PATCH', `/accounts/${fresh.id}`, { archived: true })).status, 200);
  });
  test('rekening bersaldo tidak bisa diarsipkan', async () => {
    const r = await A('PATCH', `/accounts/${bank.id}`, { archived: true });
    assert.equal(r.status, 409);
    assert.match(r.data.error, /Saldo rekening masih/);
  });
  test('rekening bersaldo nol bisa diarsipkan', async () => {
    await tx('TRANSFER', '300000', { fromAccountId: bank.id, toAccountId: kas.id });
    const r = await A('PATCH', `/accounts/${bank.id}`, { archived: true });
    assert.equal(r.status, 200);
    assert.ok(r.data.archivedAt);
  });
  test('rekening arsip tidak bisa dipakai transaksi baru', async () => {
    const r = await tx('INCOME', '1000', { accountId: bank.id, categoryId: catIn.id });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /diarsipkan/);
  });
  test('transaksi lama di rekening arsip tetap bisa diedit', async () => {
    const r = await A('PUT', `/transactions/${transfer.id}`, { type: 'TRANSFER', amount: '300000', date: today, note: 'catatan diperbaiki', fromAccountId: kas.id, toAccountId: bank.id });
    assert.equal(r.status, 200);
  });
  test('rekening arsip tetap dihitung di laporan', async () => {
    const d = await dash();
    const b = d.accountBalances.find((a: any) => a.id === bank.id);
    assert.equal(b.archived, true);
    assert.equal(b.balance, '0');
    assert.equal(d.cashBalance, '2200000');
    assert.equal(d.operatingSurplus, '300000');
  });
  test('rekening aktif terakhir tidak bisa diarsipkan', async () => {
    const only = (await B('GET', '/accounts')).data[0];
    const r = await B('PATCH', `/accounts/${only.id}`, { archived: true });
    assert.equal(r.status, 409);
    assert.match(r.data.error, /Minimal satu rekening/);
  });
  test('rekening arsip bisa diaktifkan lagi', async () => {
    const r = await A('PATCH', `/accounts/${bank.id}`, { archived: false });
    assert.equal(r.status, 200);
    assert.equal(r.data.archivedAt, null);
    assert.equal((await tx('INCOME', '1000', { accountId: bank.id, categoryId: catIn.id })).status, 201);
  });
  test('perubahan rekening tercatat di audit log', async () => {
    const logs = await prisma.auditLog.findMany({ where: { entityType: 'ACCOUNT', entityId: bank.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(logs.map(l => l.summary), ['nama "Bank Uji" -> "Bank Uji Baru"', 'diarsipkan', 'diaktifkan lagi']);
  });
});

describe('edit, hapus, filter, logout', () => {
  test('T14 edit dan hapus transaksi memperbarui surplus', async () => {
    const edited = await A('PUT', `/transactions/${inc.id}`, { type: 'INCOME', amount: '600000', date: today, note: 'uji edit', accountId: kas.id, categoryId: catIn.id });
    assert.equal(edited.status, 200);
    assert.equal((await dash()).operatingSurplus, '401000');
    assert.equal((await A('DELETE', `/transactions/${inc.id}`)).status, 204);
    assert.equal((await dash()).operatingSurplus, '-199000');
  });
  test('T15 filter type=EXPENSE', async () => {
    const f = (await A('GET', '/transactions?type=EXPENSE')).data;
    assert.equal(f.length, 1);
    assert.ok(f.every((t: any) => t.type === 'EXPENSE'));
  });
  test('T17 setelah logout /auth/me 401', async () => {
    await A('POST', '/auth/logout', {});
    assert.equal((await A('GET', '/auth/me')).status, 401);
  });
});
