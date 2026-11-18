import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Plus, ReceiptText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TxFormSheet, emptyTx } from '@/components/tx-form-sheet';
import { TxTable } from '@/components/tx-table';
import { useLiveTick } from '@/lib/live';
import { api, labels, money, post, put, type Account, type Category, type Transaction, type TxPayload, type TxType } from '@/lib/api';

export default function Transactions() {
  const [list, setList] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [initial, setInitial] = useState<TxPayload>(emptyTx());
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<TxType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const reload = async () => {
    const [tx, ac, cat] = await Promise.all([api<Transaction[]>('/transactions'), api<Account[]>('/accounts'), api<Category[]>('/categories')]);
    setList(tx); setAccounts(ac); setCategories(cat);
  };
  const live = useLiveTick(['transactions', 'accounts', 'categories']);
  useEffect(() => { void reload().catch(e => setError(e.message)); }, [live]);

  const displayed = useMemo(() => (list ?? []).filter(t =>
    (filter === 'ALL' || t.type === filter) &&
    (!search || [t.note, t.category?.name, t.account?.name].some(x => x?.toLowerCase().includes(search.toLowerCase())))
  ), [list, filter, search]);

  const openNew = () => { setEditing(null); setInitial(emptyTx(accounts.find(a => !a.archivedAt)?.id ?? '')); setSheetOpen(true); };
  const openEdit = (t: Transaction) => {
    setEditing(t.id);
    setInitial({ type: t.type, amount: t.amount, date: t.date, note: t.note, categoryId: t.categoryId, accountId: t.accountId, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId });
    setSheetOpen(true);
  };
  const save = async (data: TxPayload) => {
    if (editing) await put(`/transactions/${editing}`, data); else await post('/transactions', data);
    toast.success(editing ? 'Transaksi diperbarui' : 'Transaksi ditambahkan');
    await reload();
  };
  const remove = async () => {
    if (!toDelete) return;
    try {
      await api(`/transactions/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Transaksi dihapus');
      await reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Transaksi" description="Kelola dan telusuri semua aktivitas keuangan usaha."
        actions={<Button onClick={openNew} disabled={!list}><Plus data-icon="inline-start" />Tambah transaksi</Button>} />
      {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat transaksi</CardTitle>
          <CardDescription>Menampilkan maksimal 500 transaksi terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Cari transaksi" placeholder="Cari keterangan, kategori, akun..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as TxType | 'ALL')}>
              <SelectTrigger aria-label="Filter jenis" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="ALL">Semua jenis</SelectItem>
                {(Object.keys(labels) as TxType[]).map(t => <SelectItem key={t} value={t}>{labels[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!list ? (
            <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : displayed.length ? (
            <TxTable transactions={displayed} onEdit={openEdit} onDelete={setToDelete} />
          ) : list.length ? (
            <EmptyState icon={Search} title="Tidak ada hasil" description="Coba ubah kata kunci atau filter jenis transaksi." />
          ) : (
            <EmptyState icon={ReceiptText} title="Belum ada transaksi" description="Tambahkan transaksi pertama untuk mulai membuat riwayat keuangan."
              action={<Button size="sm" onClick={openNew}><Plus data-icon="inline-start" />Tambah transaksi</Button>} />
          )}
        </CardContent>
      </Card>

      <TxFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={Boolean(editing)} initial={initial}
        accounts={accounts} categories={categories} onSubmit={save} />
      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={o => !o && setToDelete(null)} title="Hapus transaksi?"
        description={toDelete ? <>Transaksi {labels[toDelete.type].toLowerCase()} sebesar <b className="text-foreground">{money(toDelete.amount)}</b> akan dihapus permanen. Saldo dan laporan akan dihitung ulang.</> : null}
        onConfirm={remove} />
    </>
  );
}
