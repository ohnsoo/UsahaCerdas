export type TxType = 'INCOME' | 'EXPENSE' | 'CAPITAL' | 'DRAW' | 'TRANSFER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type User = { id: string; name: string; email: string };
export type Business = { id: string; name: string; businessType: string; currency: string };
export type Account = { id: string; name: string; openingBalance: string; archivedAt: string | null; hasTransactions: boolean };
/** Rekening yang ikut dalam data transaksi (tanpa info pemakaian). */
export type AccountRef = Pick<Account, 'id' | 'name'>;
export type Category = { id: string; name: string; type: CategoryType };
export type Transaction = {
  id: string; type: TxType; amount: string; date: string; note: string;
  categoryId: string | null; accountId: string | null; fromAccountId: string | null; toAccountId: string | null;
  category?: Category | null; account?: AccountRef | null; fromAccount?: AccountRef | null; toAccount?: AccountRef | null;
};
export type TxPayload = Pick<Transaction, 'type' | 'amount' | 'date' | 'note' | 'categoryId' | 'accountId' | 'fromAccountId' | 'toAccountId'>;
export type Summary = {
  period: { from: string; to: string };
  cashBalance: string; income: string; expense: string; operatingSurplus: string;
  capital: string; draws: string; netCashMovement: string;
  accountBalances: { id: string; name: string; archived: boolean; balance: string }[];
  chart: { month: string; income: number; expense: number }[];
  recentTransactions: Transaction[];
  expenseCategories: { name: string; amount: string }[];
};
export const money = (val: number | string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(Number(val) || 0);
export const dateLabel = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00.000Z'));
export const localDate = () => { const d = new Date(); const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10); };
export const startOfMonth = () => localDate().slice(0, 7) + '-01';
export const labels: Record<TxType, string> = { INCOME: 'Pemasukan', EXPENSE: 'Pengeluaran', CAPITAL: 'Setoran Modal', DRAW: 'Prive', TRANSFER: 'Transfer Kas' };
/** Angka ringkas untuk sumbu grafik: 1,5 jt / 250 rb. Hanya untuk tampilan. */
export const compactMoney = (v: number) => {
  const n = Math.abs(v);
  if (n >= 1_000_000_000) return `${(v / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000) return `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `${(v / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(v);
};
/** Transaksi yang mengurangi kas akun utamanya. Transfer ditampilkan netral. */
export const isOutflow = (type: TxType) => type === 'EXPENSE' || type === 'DRAW';

/** ID unik per tab. Dikirim sebagai X-Client-Id agar backend tidak memantulkan event ke tab pengirim. */
export const CLIENT_ID = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init, credentials: 'include',
      headers: { 'X-Client-Id': CLIENT_ID, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
    });
  } catch {
    throw new Error('Gagal terhubung ke backend. Pastikan server sedang berjalan.');
  }
  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data === 'object' && data && 'error' in data ? String(data.error) : `HTTP ${res.status}`);
  return data as T;
}
export const post = <T,>(path: string, data: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const put = <T,>(path: string, data: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(data) });
export const patch = <T,>(path: string, data: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
