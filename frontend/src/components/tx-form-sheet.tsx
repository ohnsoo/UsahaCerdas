import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { labels, localDate, type Account, type Category, type TxPayload, type TxType } from '@/lib/api';

const typeHelp: Record<TxType, string> = {
  INCOME: 'Uang masuk dari kegiatan usaha, misalnya penjualan.',
  EXPENSE: 'Uang keluar untuk kegiatan usaha, misalnya bahan baku.',
  CAPITAL: 'Uang pribadi pemilik yang disetor ke usaha. Tidak dihitung sebagai pendapatan.',
  DRAW: 'Uang usaha yang diambil untuk keperluan pribadi. Tidak dihitung sebagai biaya.',
  TRANSFER: 'Memindahkan uang antar rekening usaha. Total kas tidak berubah.',
};

export const emptyTx = (accountId = ''): TxPayload => ({
  type: 'INCOME', amount: '', date: localDate(), note: '', categoryId: null, accountId, fromAccountId: accountId || null, toAccountId: null,
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  initial: TxPayload;
  accounts: Account[];
  categories: Category[];
  onSubmit: (data: TxPayload) => Promise<void>;
};

export function TxFormSheet({ open, onOpenChange, editing, initial, accounts, categories, onSubmit }: Props) {
  const [form, setForm] = useState<TxPayload>(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm(initial); setError(''); } }, [open, initial]);

  // Rekening arsip disembunyikan, kecuali yang memang sudah dipakai transaksi yang sedang diedit.
  const usable = useMemo(() => {
    const keep = new Set([initial.accountId, initial.fromAccountId, initial.toAccountId]);
    return accounts.filter(a => !a.archivedAt || (editing && keep.has(a.id)));
  }, [accounts, initial, editing]);
  const eligible = useMemo(() => categories.filter(c => c.type === form.type), [categories, form.type]);
  const set = <K extends keyof TxPayload>(key: K, value: TxPayload[K]) => setForm(f => ({ ...f, [key]: value }));
  const needsCategory = form.type === 'INCOME' || form.type === 'EXPENSE';
  const transfer = form.type === 'TRANSFER';

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (transfer && (!form.fromAccountId || !form.toAccountId)) return setError('Pilih rekening asal dan tujuan.');
    if (!transfer && !form.accountId) return setError('Pilih rekening kas.');
    if (needsCategory && !form.categoryId) return setError('Pilih kategori transaksi.');
    setBusy(true);
    try { await onSubmit(form); onOpenChange(false); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const accountSelect = (id: string, label: string, value: string | null, onChange: (v: string) => void, placeholder: string) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent position="popper">{usable.map(a => <SelectItem key={a.id} value={a.id}>{a.name}{a.archivedAt ? ' (diarsipkan)' : ''}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? 'Edit transaksi' : 'Transaksi baru'}</SheetTitle>
          <SheetDescription>Pilih jenis yang tepat agar laporan akurat.</SheetDescription>
        </SheetHeader>
        <form id="tx-form" onSubmit={submit} className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
          {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="grid gap-2">
            <Label htmlFor="tx-type">Jenis transaksi</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as TxType, categoryId: null }))}>
              <SelectTrigger id="tx-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {(Object.keys(labels) as TxType[]).map(t => <SelectItem key={t} value={t}>{labels[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{typeHelp[form.type]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="tx-amount">Nominal (Rp)</Label>
              <Input id="tx-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount}
                onChange={e => set('amount', e.target.value)} placeholder="150000" className="tabular" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-date">Tanggal</Label>
              <Input id="tx-date" type="date" required value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          {transfer ? (
            <div className="grid grid-cols-2 gap-3">
              {accountSelect('tx-from', 'Dari rekening', form.fromAccountId, v => set('fromAccountId', v), 'Rekening asal')}
              {accountSelect('tx-to', 'Ke rekening', form.toAccountId, v => set('toAccountId', v), 'Rekening tujuan')}
            </div>
          ) : accountSelect('tx-account', 'Rekening kas', form.accountId, v => set('accountId', v), 'Pilih rekening')}
          {needsCategory && (
            <div className="grid gap-2">
              <Label htmlFor="tx-category">Kategori</Label>
              <Select value={form.categoryId ?? ''} onValueChange={v => set('categoryId', v)}>
                <SelectTrigger id="tx-category" className="w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent position="popper">{eligible.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="tx-note">Keterangan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
            <Input id="tx-note" maxLength={500} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Contoh: Penjualan kopi hari ini" />
          </div>
        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button type="submit" form="tx-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
            {editing ? 'Simpan perubahan' : 'Simpan transaksi'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
