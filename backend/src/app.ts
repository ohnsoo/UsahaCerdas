import 'dotenv/config';
import express, { type NextFunction, type Request, type Response, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, PrismaClient, type TransactionType } from '@prisma/client';
import { z, ZodError } from 'zod';

export const app = express();
export const prisma = new PrismaClient();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || '';
if (JWT_SECRET.length < 32 || JWT_SECRET.includes('GANTI_DENGAN')) {
  throw new Error('Konfigurasikan JWT_SECRET acak minimal 32 karakter di backend/.env.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== CLIENT_ORIGIN) {
      res.status(403).json({ error: 'Origin tidak diizinkan.' }); return;
    }
    // Handler DELETE tidak membaca body, jadi tidak wajib JSON. Proxy (mis. Vite) bisa meneruskan DELETE
    // dengan Transfer-Encoding: chunked sehingga Express menganggapnya ber-body. Cek Origin di atas tetap berlaku.
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type wajib application/json.' }); return;
    }
  }
  next();
});

const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };

const auth: RequestHandler = (req, res, next) => {
  try {
    const token = req.cookies?.session;
    if (!token || typeof token !== 'string') { res.status(401).json({ error: 'Silakan login terlebih dahulu.' }); return; }
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Token invalid');
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
  }
};

async function getBusiness(res: Response) {
  const business = await prisma.business.findFirst({ where: { ownerId: res.locals.userId as string } });
  if (!business) throw Object.assign(new Error('Usaha tidak ditemukan.'), { status: 404 });
  return business;
}
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD').refine(v =>
  !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00.000Z').toISOString().slice(0, 10) === v, 'Tanggal tidak valid');
const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;
// Zod v3 tetap menjalankan refine walau regex gagal; cek format dulu agar Decimal tidak melempar error (500).
const amountString = z.string().regex(AMOUNT_RE, 'Nominal tidak valid')
  .refine(v => !AMOUNT_RE.test(v) || new Prisma.Decimal(v).greaterThan(0), 'Nominal harus lebih dari nol');
const openingAmount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Saldo awal tidak valid');
const userPayload = z.object({ email: z.string().trim().email().max(200), password: z.string().min(8).max(128) });
const registerPayload = userPayload.extend({ name: z.string().trim().min(2).max(80), businessName: z.string().trim().min(2).max(100) });
const transactionPayload = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'CAPITAL', 'DRAW', 'TRANSFER']),
  amount: amountString,
  date: dateString,
  note: z.string().trim().max(500).default(''),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  fromAccountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
});
function setSession(res: Response, userId: string) {
  const token = jwt.sign({}, JWT_SECRET, { subject: userId, expiresIn: '7d', algorithm: 'HS256' });
  res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400 * 1000, path: '/' });
}
function asDate(v: string) { return new Date(v + 'T00:00:00.000Z'); }
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStart = () => todayStr().slice(0, 7) + '-01';
const serialize = (t: any) => ({ ...t, amount: t.amount.toString(), date: t.date.toISOString().slice(0, 10) });

app.get('/api/health', (_req, res) => res.json({ ok: true, application: 'UsahaCerdas', version: '0.1.0' }));

// Auth
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const data = registerPayload.parse(req.body);
  const email = data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) { res.status(409).json({ error: 'Email sudah terdaftar.' }); return; }
  const hashed = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email, passwordHash: hashed,
      businesses: { create: { name: data.businessName,
        accounts: { create: [{ name: 'Kas Utama', openingBalance: new Prisma.Decimal(0) }] },
        categories: { create: [
          { name: 'Penjualan', type: 'INCOME' }, { name: 'Pendapatan Lain', type: 'INCOME' },
          { name: 'Bahan Baku', type: 'EXPENSE' }, { name: 'Operasional', type: 'EXPENSE' },
          { name: 'Transportasi', type: 'EXPENSE' }, { name: 'Lain-lain', type: 'EXPENSE' }
        ] }
      } }
    }, select: { id: true, name: true, email: true }
  });
  setSession(res, user.id);
  res.status(201).json({ user });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = userPayload.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    res.status(401).json({ error: 'Email atau password salah.' }); return;
  }
  setSession(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
}));
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ message: 'Logout berhasil.' });
});
app.get('/api/auth/me', auth, asyncRoute(async (_req, res) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.userId as string }, select: { id: true, name: true, email: true } });
  if (!user) { res.status(401).json({ error: 'User tidak ditemukan.' }); return; }
  const business = await getBusiness(res);
  res.json({ user, business });
}));

// Business
app.get('/api/business', auth, asyncRoute(async (_req, res) => { res.json(await getBusiness(res)); }));
app.patch('/api/business', auth, asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(2).max(100), businessType: z.string().trim().min(2).max(100) }).parse(req.body);
  const business = await getBusiness(res);
  res.json(await prisma.business.update({ where: { id: business.id }, data }));
}));

// Accounts
const accountName = z.string().trim().min(2).max(70);
const accountUsage = { _count: { select: { transactions: true, transfersOut: true, transfersIn: true } } } as const;
type AccountWithUsage = Prisma.AccountGetPayload<{ include: typeof accountUsage }>;
const usedCount = (a: AccountWithUsage) => a._count.transactions + a._count.transfersOut + a._count.transfersIn;
const serializeAccount = ({ _count, ...a }: AccountWithUsage) => ({
  ...a, openingBalance: a.openingBalance.toString(), archivedAt: a.archivedAt?.toISOString() ?? null,
  hasTransactions: _count.transactions + _count.transfersOut + _count.transfersIn > 0,
});
// Saldo sepanjang waktu (semua tanggal) dengan aritmetika Decimal.
async function accountBalance(accountId: string, openingBalance: Prisma.Decimal) {
  const rows = await prisma.transaction.findMany({
    where: { OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }] },
    select: { type: true, amount: true, accountId: true, fromAccountId: true, toAccountId: true },
  });
  return rows.reduce((bal, t) => {
    if (t.type === 'TRANSFER') return t.toAccountId === accountId ? bal.plus(t.amount) : bal.minus(t.amount);
    return t.type === 'INCOME' || t.type === 'CAPITAL' ? bal.plus(t.amount) : bal.minus(t.amount);
  }, openingBalance);
}
// Hanya untuk teks pesan error; perhitungan tetap memakai Decimal.
const rupiah = (d: Prisma.Decimal) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(d.toNumber());
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });

app.get('/api/accounts', auth, asyncRoute(async (_req, res) => {
  const business = await getBusiness(res);
  const accounts = await prisma.account.findMany({ where: { businessId: business.id }, include: accountUsage, orderBy: { createdAt: 'asc' } });
  res.json(accounts.map(serializeAccount));
}));
app.post('/api/accounts', auth, asyncRoute(async (req, res) => {
  const data = z.object({ name: accountName, openingBalance: openingAmount.default('0') }).parse(req.body);
  const business = await getBusiness(res);
  const account = await prisma.account.create({ data: { ...data, businessId: business.id }, include: accountUsage });
  res.status(201).json(serializeAccount(account));
}));
app.patch('/api/accounts/:id', auth, asyncRoute(async (req, res) => {
  const data = z.object({ name: accountName.optional(), openingBalance: openingAmount.optional(), archived: z.boolean().optional() })
    .refine(d => d.name !== undefined || d.openingBalance !== undefined || d.archived !== undefined, 'Tidak ada perubahan yang dikirim.')
    .parse(req.body);
  const business = await getBusiness(res);
  const existing = await prisma.account.findFirst({ where: { id: req.params.id, businessId: business.id }, include: accountUsage });
  if (!existing) { res.status(404).json({ error: 'Rekening tidak ditemukan.' }); return; }

  const opening = data.openingBalance === undefined ? existing.openingBalance : new Prisma.Decimal(data.openingBalance);
  const openingChanged = !opening.equals(existing.openingBalance);
  // Saldo awal yang berubah setelah ada transaksi akan menggeser saldo di semua laporan periode lalu.
  if (openingChanged && usedCount(existing) > 0) {
    throw conflict('Saldo awal tidak bisa diubah karena rekening sudah punya transaksi. Catat selisihnya sebagai transaksi.');
  }
  const archiving = data.archived === true && !existing.archivedAt;
  if (archiving) {
    const otherActive = await prisma.account.count({ where: { businessId: business.id, archivedAt: null, id: { not: existing.id } } });
    if (otherActive === 0) throw conflict('Minimal satu rekening harus tetap aktif.');
    const balance = await accountBalance(existing.id, opening);
    if (!balance.isZero()) throw conflict(`Saldo rekening masih ${rupiah(balance)}. Pindahkan saldonya ke rekening lain dulu sebelum mengarsipkan.`);
  }
  const restoring = data.archived === false && existing.archivedAt !== null;

  const changes: string[] = [];
  if (data.name !== undefined && data.name !== existing.name) changes.push(`nama "${existing.name}" -> "${data.name}"`);
  if (openingChanged) changes.push(`saldo awal ${existing.openingBalance} -> ${opening}`);
  if (archiving) changes.push('diarsipkan');
  if (restoring) changes.push('diaktifkan lagi');

  const account = await prisma.$transaction(async tx => {
    const updated = await tx.account.update({
      where: { id: existing.id }, include: accountUsage,
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(openingChanged ? { openingBalance: opening } : {}),
        ...(archiving ? { archivedAt: new Date() } : restoring ? { archivedAt: null } : {}),
      },
    });
    if (changes.length) {
      await tx.auditLog.create({ data: { businessId: business.id, userId: res.locals.userId as string, action: 'UPDATE', entityType: 'ACCOUNT', entityId: existing.id, summary: changes.join('; ') } });
    }
    return updated;
  });
  res.json(serializeAccount(account));
}));

// Categories
app.get('/api/categories', auth, asyncRoute(async (_req, res) => {
  const business = await getBusiness(res);
  res.json(await prisma.category.findMany({ where: { businessId: business.id }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }));
}));
app.post('/api/categories', auth, asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(2).max(70), type: z.enum(['INCOME','EXPENSE']) }).parse(req.body);
  const business = await getBusiness(res);
  res.status(201).json(await prisma.category.create({ data: { ...data, businessId: business.id } }));
}));
app.delete('/api/categories/:id', auth, asyncRoute(async (req, res) => {
  const business = await getBusiness(res);
  const existing = await prisma.category.findFirst({ where: { id: req.params.id, businessId: business.id } });
  if (!existing) { res.status(404).json({ error: 'Kategori tidak ditemukan.' }); return; }
  await prisma.category.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

// Transactions
// `keepArchived`: rekening arsip yang sudah dipakai transaksi ini sebelumnya (saat edit) tetap boleh dipakai.
async function checkedTransaction(data: z.infer<typeof transactionPayload>, businessId: string, keepArchived: (string | null)[] = []) {
  const transfer = data.type === 'TRANSFER';
  const catRequired = data.type === 'INCOME' || data.type === 'EXPENSE';
  if (transfer && (!data.fromAccountId || !data.toAccountId || data.fromAccountId === data.toAccountId)) {
    throw Object.assign(new Error('Transfer memerlukan dua rekening berbeda.'), { status: 400 });
  }
  if (!transfer && !data.accountId) throw Object.assign(new Error('Pilih rekening kas.'), { status: 400 });
  if (catRequired && !data.categoryId) throw Object.assign(new Error('Pilih kategori transaksi.'), { status: 400 });
  const accountIds = transfer ? [data.fromAccountId!, data.toAccountId!] : [data.accountId!];
  const validAccounts = await prisma.account.findMany({ where: { businessId, id: { in: accountIds } }, select: { id: true, name: true, archivedAt: true } });
  if (validAccounts.length !== accountIds.length) throw Object.assign(new Error('Rekening tidak tersedia untuk usaha ini.'), { status: 400 });
  const archived = validAccounts.find(a => a.archivedAt && !keepArchived.includes(a.id));
  if (archived) throw Object.assign(new Error(`Rekening "${archived.name}" sudah diarsipkan. Aktifkan lagi di Pengaturan untuk memakainya.`), { status: 400 });
  if (catRequired) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId!, businessId } });
    if (!category || category.type !== data.type) throw Object.assign(new Error('Kategori tidak cocok dengan jenis transaksi.'), { status: 400 });
  }
  return {
    type: data.type as TransactionType, amount: new Prisma.Decimal(data.amount), date: asDate(data.date), note: data.note,
    categoryId: catRequired ? data.categoryId! : null,
    accountId: transfer ? null : data.accountId!,
    fromAccountId: transfer ? data.fromAccountId! : null,
    toAccountId: transfer ? data.toAccountId! : null,
  };
}
app.get('/api/transactions', auth, asyncRoute(async (req, res) => {
  const business = await getBusiness(res);
  const filters = z.object({ from: dateString.optional(), to: dateString.optional(), type: z.enum(['INCOME','EXPENSE','CAPITAL','DRAW','TRANSFER']).optional(), categoryId: z.string().optional(), search: z.string().max(100).optional() }).parse(req.query);
  if (filters.from && filters.to && filters.from > filters.to) { res.status(400).json({ error:'Periode tidak valid.' }); return; }
  const list = await prisma.transaction.findMany({
    where: { businessId: business.id,
      ...(filters.from || filters.to ? { date: { ...(filters.from ? { gte: asDate(filters.from) } : {}), ...(filters.to ? { lte: asDate(filters.to) } : {}) } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.search ? { note: { contains: filters.search, mode: 'insensitive' as const } } : {}),
    }, include: { category: true, account: true, fromAccount: true, toAccount: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 500
  });
  res.json(list.map(serialize));
}));
app.post('/api/transactions', auth, asyncRoute(async (req, res) => {
  const business = await getBusiness(res);
  const data = await checkedTransaction(transactionPayload.parse(req.body), business.id);
  const record = await prisma.transaction.create({ data: { ...data, businessId: business.id, createdById: res.locals.userId as string } });
  await prisma.auditLog.create({ data: { businessId: business.id, userId: res.locals.userId as string, action: 'CREATE', entityType: 'TRANSACTION', entityId: record.id, summary: `${record.type} ${record.amount}` } });
  res.status(201).json(serialize(record));
}));
app.put('/api/transactions/:id', auth, asyncRoute(async (req, res) => {
  const business = await getBusiness(res);
  const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, businessId: business.id } });
  if (!existing) { res.status(404).json({ error: 'Transaksi tidak ditemukan.' }); return; }
  const data = await checkedTransaction(transactionPayload.parse(req.body), business.id,
    [existing.accountId, existing.fromAccountId, existing.toAccountId]);
  const record = await prisma.$transaction(async tx => {
    const updated = await tx.transaction.update({ where: { id: existing.id }, data });
    await tx.auditLog.create({ data: { businessId: business.id, userId: res.locals.userId as string, action: 'UPDATE', entityType: 'TRANSACTION', entityId: existing.id, summary: `${existing.type} ${existing.amount} → ${updated.type} ${updated.amount}` } });
    return updated;
  });
  res.json(serialize(record));
}));
app.delete('/api/transactions/:id', auth, asyncRoute(async (req, res) => {
  const business = await getBusiness(res);
  const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, businessId: business.id } });
  if (!existing) { res.status(404).json({ error: 'Transaksi tidak ditemukan.' }); return; }
  await prisma.$transaction(async tx => {
    await tx.transaction.delete({ where: { id: existing.id } });
    await tx.auditLog.create({ data: { businessId: business.id, userId: res.locals.userId as string, action: 'DELETE', entityType: 'TRANSACTION', entityId: existing.id, summary: `${existing.type} ${existing.amount}` } });
  });
  res.status(204).send();
}));

// Shared financial summary: all totals via decimal arithmetic, period included.
async function summary(req: Request, res: Response) {
  const business = await getBusiness(res);
  const filters = z.object({ from: dateString.default(monthStart()), to: dateString.default(todayStr()) }).parse(req.query);
  if (filters.from > filters.to) { res.status(400).json({ error:'Periode tidak valid.' }); return; }
  const accounts = await prisma.account.findMany({ where: { businessId: business.id } });
  const records = await prisma.transaction.findMany({
    where: { businessId: business.id, date: { lte: asDate(filters.to) } },
    include: { category: true, account: true, fromAccount: true, toAccount: true },
    orderBy: [{ date:'desc' }, { createdAt:'desc' }]
  });
  const ZERO = new Prisma.Decimal(0);
  const accountBalances = new Map(accounts.map(a => [a.id, a.openingBalance]));
  const totals: Record<'INCOME'|'EXPENSE'|'CAPITAL'|'DRAW', Prisma.Decimal> = { INCOME: ZERO, EXPENSE: ZERO, CAPITAL: ZERO, DRAW: ZERO };
  const monthly = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
  const expenseCategories = new Map<string, Prisma.Decimal>();
  const period = records.filter(t => t.date.toISOString().slice(0, 10) >= filters.from);
  for (const t of records) {
    if (t.type === 'TRANSFER') {
      accountBalances.set(t.fromAccountId!, accountBalances.get(t.fromAccountId!)!.minus(t.amount));
      accountBalances.set(t.toAccountId!, accountBalances.get(t.toAccountId!)!.plus(t.amount));
    } else {
      const current = accountBalances.get(t.accountId!)!;
      const plus = t.type === 'INCOME' || t.type === 'CAPITAL';
      accountBalances.set(t.accountId!, plus ? current.plus(t.amount) : current.minus(t.amount));
    }
    const ym = t.date.toISOString().slice(0, 7);
    if (t.type === 'INCOME' || t.type === 'EXPENSE') {
      const current = monthly.get(ym) || { income: ZERO, expense: ZERO };
      current[t.type === 'INCOME' ? 'income' : 'expense'] = current[t.type === 'INCOME' ? 'income' : 'expense'].plus(t.amount);
      monthly.set(ym, current);
    }
  }
  for (const t of period) {
    if (t.type !== 'TRANSFER') totals[t.type] = totals[t.type].plus(t.amount);
    if (t.type === 'EXPENSE') {
      const name = t.category?.name || 'Tidak berkategori';
      expenseCategories.set(name, (expenseCategories.get(name) || ZERO).plus(t.amount));
    }
  }
  const cashBalance = [...accountBalances.values()].reduce((acc, n) => acc.plus(n), ZERO);
  // Chart for six most recent calendar months (ending on filter.to).
  const end = asDate(filters.to);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (5 - i), 1));
    const key = d.toISOString().slice(0, 7);
    const item = monthly.get(key) || { income: ZERO, expense: ZERO };
    return { month: key, income: item.income.toNumber(), expense: item.expense.toNumber() };
  });
  res.json({
    period: filters,
    cashBalance: cashBalance.toString(),
    income: totals.INCOME.toString(), expense: totals.EXPENSE.toString(),
    operatingSurplus: totals.INCOME.minus(totals.EXPENSE).toString(),
    capital: totals.CAPITAL.toString(), draws: totals.DRAW.toString(),
    netCashMovement: totals.INCOME.plus(totals.CAPITAL).minus(totals.EXPENSE).minus(totals.DRAW).toString(),
    accountBalances: accounts.map(a => ({ id: a.id, name: a.name, archived: a.archivedAt !== null, balance: accountBalances.get(a.id)!.toString() })),
    chart: months, recentTransactions: period.slice(0, 5).map(serialize),
    expenseCategories: [...expenseCategories.entries()].map(([name,amount]) => ({ name, amount: amount.toString() })).sort((a,b) => Number(b.amount) - Number(a.amount))
  });
}
app.get('/api/dashboard', auth, asyncRoute(summary));
app.get('/api/reports', auth, asyncRoute(summary));
app.use((_req, res) => { res.status(404).json({ error: 'Endpoint tidak ditemukan.' }); });
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) { res.status(400).json({ error: error.issues.map(x => x.message).join('; ') }); return; }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Data sudah ada. Gunakan nama atau email berbeda.' }); return; }
    if (error.code === 'P2003') { res.status(409).json({ error: 'Data sedang digunakan dan tidak dapat dihapus.' }); return; }
  }
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as {status: number}).status) : 500;
  if (status >= 500) console.error(error);
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: status >= 500 ? 'Terjadi kesalahan server.' : (error instanceof Error ? error.message : 'Permintaan tidak valid.') });
});
