import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Archive, ArchiveRestore, CircleAlert, CreditCard, Loader2, MoreHorizontal, Pencil, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { api, money, patch, post, type Account } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveTick } from '@/lib/live';
import { cn } from '@/lib/utils';

function AccountRow({ account, children }: { account: Account; children: ReactNode }) {
  const archived = Boolean(account.archivedAt);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50', archived && 'opacity-60')}>
        <CreditCard className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', archived && 'text-muted-foreground')}>{account.name}</p>
        <p className="text-xs text-muted-foreground">Saldo awal <span className="tabular">{money(account.openingBalance)}</span></p>
      </div>
      {children}
    </div>
  );
}

function EditAccountDialog({ account, onOpenChange, onSaved }: { account: Account | null; onOpenChange: (o: boolean) => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('0');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (account) { setName(account.name); setOpening(String(Number(account.openingBalance))); setError(''); }
  }, [account]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const body: { name?: string; openingBalance?: string } = {};
    if (name.trim() !== account.name) body.name = name.trim();
    if (!account.hasTransactions && Number(opening) !== Number(account.openingBalance)) body.openingBalance = opening;
    if (!Object.keys(body).length) { onOpenChange(false); return; }
    setBusy(true); setError('');
    try { await patch(`/accounts/${account.id}`, body); await onSaved(); toast.success('Rekening diperbarui'); onOpenChange(false); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={Boolean(account)} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah rekening</DialogTitle>
          <DialogDescription>Perubahan nama langsung terlihat di seluruh riwayat transaksi.</DialogDescription>
        </DialogHeader>
        <form id="edit-account" onSubmit={submit} className="grid gap-4">
          {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="grid gap-2">
            <Label htmlFor="edit-acc-name">Nama rekening</Label>
            <Input id="edit-acc-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={70} required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-acc-opening">Saldo awal (Rp)</Label>
            <Input id="edit-acc-opening" type="number" inputMode="decimal" step="0.01" min="0" required className="tabular"
              value={opening} onChange={e => setOpening(e.target.value)} disabled={account?.hasTransactions} />
            {account?.hasTransactions && (
              <p className="text-xs text-muted-foreground">
                Tidak bisa diubah karena rekening ini sudah punya transaksi. Jika saldo awal keliru, catat selisihnya sebagai setoran modal atau prive.
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button type="submit" form="edit-account" disabled={busy}>
            {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const { session, refresh } = useAuth();
  const [name, setName] = useState(session?.business.name ?? '');
  const [businessType, setBusinessType] = useState(session?.business.businessType ?? 'Umum');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountName, setAccountName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [profileError, setProfileError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [busy, setBusy] = useState<'profile' | 'account' | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  // Target dipisah dari status buka agar nama rekening tidak hilang selama animasi dialog menutup.
  const [toArchive, setToArchive] = useState<Account | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const reload = async () => setAccounts(await api<Account[]>('/accounts'));
  const live = useLiveTick(['accounts']);
  useEffect(() => { void reload().catch(e => setAccountError(e.message)); }, [live]);

  // Profil diubah dari perangkat lain: perbarui form, kecuali pengguna sedang mengetik perubahan sendiri.
  const synced = useRef({ name, businessType });
  useEffect(() => {
    const b = session?.business;
    if (!b) return;
    const dirty = name !== synced.current.name || businessType !== synced.current.businessType;
    synced.current = { name: b.name, businessType: b.businessType };
    if (!dirty) { setName(b.name); setBusinessType(b.businessType); }
  }, [session?.business.name, session?.business.businessType]);

  const active = accounts?.filter(a => !a.archivedAt) ?? [];
  const archived = accounts?.filter(a => a.archivedAt) ?? [];

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy('profile'); setProfileError('');
    try { await patch('/business', { name, businessType }); await refresh(); toast.success('Profil usaha diperbarui'); }
    catch (err) { setProfileError((err as Error).message); }
    finally { setBusy(null); }
  };
  const add = async (e: FormEvent) => {
    e.preventDefault(); setBusy('account'); setAccountError('');
    try {
      await post('/accounts', { name: accountName, openingBalance });
      setAccountName(''); setOpeningBalance('0'); await reload(); toast.success('Rekening ditambahkan');
    } catch (err) { setAccountError((err as Error).message); }
    finally { setBusy(null); }
  };
  const archive = async () => {
    if (!toArchive) return;
    try { await patch(`/accounts/${toArchive.id}`, { archived: true }); await reload(); toast.success(`Rekening "${toArchive.name}" diarsipkan`); }
    catch (err) { toast.error((err as Error).message); }
  };
  const restore = async (a: Account) => {
    setRestoring(a.id);
    try { await patch(`/accounts/${a.id}`, { archived: false }); await reload(); toast.success(`Rekening "${a.name}" aktif lagi`); }
    catch (err) { toast.error((err as Error).message); }
    finally { setRestoring(null); }
  };

  return (
    <>
      <PageHeader title="Pengaturan" description="Profil usaha dan rekening kas yang digunakan." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil usaha</CardTitle>
            <CardDescription>Informasi dasar pemilik dan usaha.</CardDescription>
          </CardHeader>
          <form onSubmit={save} className="contents">
            <CardContent className="grid gap-4">
              {profileError && <Alert variant="destructive"><CircleAlert /><AlertDescription>{profileError}</AlertDescription></Alert>}
              <div className="grid gap-2">
                <Label htmlFor="biz-name">Nama usaha</Label>
                <Input id="biz-name" value={name} minLength={2} maxLength={100} required onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="biz-type">Bidang usaha</Label>
                <Input id="biz-type" value={businessType} minLength={2} maxLength={100} required onChange={e => setBusinessType(e.target.value)} placeholder="Contoh: Kuliner" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner-email">Email pemilik</Label>
                <Input id="owner-email" disabled value={session?.user.email ?? ''} readOnly />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button type="submit" disabled={busy === 'profile'}>
                {busy === 'profile' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}Simpan profil
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rekening kas</CardTitle>
            <CardDescription>Saldo awal hanya untuk uang yang sudah ada sebelum pencatatan dimulai, bukan pendapatan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!accounts ? <Skeleton className="h-24" /> : (
              <div className="divide-y rounded-lg border">
                {active.map(a => (
                  <AccountRow key={a.id} account={a}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Aksi rekening ${a.name}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(a)}><Pencil />Ubah</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => { setToArchive(a); setArchiveOpen(true); }} disabled={active.length <= 1}><Archive />Arsipkan</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AccountRow>
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <div className="grid gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Diarsipkan ({archived.length})</p>
                <div className="divide-y rounded-lg border border-dashed">
                  {archived.map(a => (
                    <AccountRow key={a.id} account={a}>
                      <Button variant="ghost" size="sm" onClick={() => restore(a)} disabled={restoring === a.id}>
                        {restoring === a.id ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ArchiveRestore data-icon="inline-start" />}Aktifkan
                      </Button>
                    </AccountRow>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={add} className="grid gap-4 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Tambah rekening</p>
              {accountError && <Alert variant="destructive"><CircleAlert /><AlertDescription>{accountError}</AlertDescription></Alert>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="acc-name">Nama rekening</Label>
                  <Input id="acc-name" value={accountName} onChange={e => setAccountName(e.target.value)} minLength={2} maxLength={70} required placeholder="Contoh: Rekening BCA" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="acc-opening">Saldo awal (Rp)</Label>
                  <Input id="acc-opening" type="number" inputMode="decimal" step="0.01" min="0" required value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="tabular" />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={busy === 'account'}>
                {busy === 'account' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}Tambah rekening
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <EditAccountDialog account={editing} onOpenChange={o => !o && setEditing(null)} onSaved={reload} />
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title="Arsipkan rekening?"
        destructive={false} confirmLabel="Arsipkan" busyLabel="Mengarsipkan..." onConfirm={archive}
        description={<>
          Rekening <b className="text-foreground">{toArchive?.name}</b> tidak akan muncul lagi di form transaksi baru.
          Riwayat transaksinya tetap ada dan tetap dihitung di laporan. Saldonya harus nol dulu; pindahkan sisa saldo lewat transfer kas.
        </>} />
    </>
  );
}
