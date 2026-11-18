import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Loader2, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { api, post, type Category, type CategoryType } from '@/lib/api';
import { cn } from '@/lib/utils';

const groups: { type: CategoryType; title: string; icon: typeof ArrowDownLeft; tone: string }[] = [
  { type: 'INCOME', title: 'Pemasukan', icon: ArrowDownLeft, tone: 'bg-income/10 text-income' },
  { type: 'EXPENSE', title: 'Pengeluaran', icon: ArrowUpRight, tone: 'bg-expense/10 text-expense' },
];

export default function Categories() {
  const [list, setList] = useState<Category[] | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const reload = async () => setList(await api<Category[]>('/categories'));
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await post('/categories', { name, type }); await reload(); setName(''); toast.success('Kategori ditambahkan'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!toDelete) return;
    try { await api(`/categories/${toDelete.id}`, { method: 'DELETE' }); await reload(); toast.success('Kategori dihapus'); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <>
      <PageHeader title="Kategori" description="Kelompokkan transaksi agar sumber pemasukan dan biaya lebih jelas." />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daftar kategori</CardTitle>
            <CardDescription>Kategori yang sudah dipakai transaksi tidak bisa dihapus.</CardDescription>
          </CardHeader>
          <CardContent>
            {!list ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
              : !list.length ? <EmptyState icon={Tags} title="Belum ada kategori" description="Tambahkan kategori pertama di formulir samping." />
              : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {groups.map(({ type: t, title, icon: Icon, tone }) => {
                    const items = list.filter(c => c.type === t);
                    return (
                      <div key={t} className="space-y-2">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {title}<span className="text-muted-foreground">{items.length}</span>
                        </p>
                        <div className="divide-y rounded-lg border">
                          {items.length ? items.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                              <span className={cn('flex size-7 items-center justify-center rounded-md', tone)}><Icon className="size-3.5" /></span>
                              <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                              <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${c.name}`} onClick={() => setToDelete(c)}>
                                <Trash2 className="text-muted-foreground" />
                              </Button>
                            </div>
                          )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">Belum ada</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tambah kategori</CardTitle>
            <CardDescription>Gunakan nama yang mudah dipahami.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="grid gap-2">
                <Label htmlFor="cat-name">Nama kategori</Label>
                <Input id="cat-name" required minLength={2} maxLength={70} value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Biaya listrik" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-type">Jenis</Label>
                <Select value={type} onValueChange={v => setType(v as CategoryType)}>
                  <SelectTrigger id="cat-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="INCOME">Pemasukan</SelectItem>
                    <SelectItem value="EXPENSE">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}Tambah kategori
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={o => !o && setToDelete(null)} title="Hapus kategori?"
        description={<>Kategori <b className="text-foreground">{toDelete?.name}</b> akan dihapus. Kategori yang sudah dipakai transaksi tidak dapat dihapus.</>}
        onConfirm={remove} />
    </>
  );
}
