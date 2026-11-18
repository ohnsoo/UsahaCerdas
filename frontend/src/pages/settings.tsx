import { useEffect, useState, type FormEvent } from 'react';
import { CircleAlert, CreditCard, Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';
import { api, money, patch, post, type Account } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

  const reload = async () => setAccounts(await api<Account[]>('/accounts'));
  useEffect(() => { void reload().catch(e => setAccountError(e.message)); }, []);

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
                {accounts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex size-8 items-center justify-center rounded-md border bg-muted/50"><CreditCard className="size-4 text-muted-foreground" /></div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                    <span className="text-right text-xs text-muted-foreground">Saldo awal<br /><span className="text-sm text-foreground tabular">{money(a.openingBalance)}</span></span>
                  </div>
                ))}
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
    </>
  );
}
