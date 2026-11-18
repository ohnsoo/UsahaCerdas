import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AuthPage({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const { session, refresh } = useAuth();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await post(register ? '/auth/register' : '/auth/login', register ? { name, businessName, email, password } : { email, password });
      await refresh();
      navigate('/app', { replace: true });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Button variant="ghost" size="sm" asChild><Link to="/"><ArrowLeft data-icon="inline-start" />Beranda</Link></Button>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{register ? 'Buat akun UsahaCerdas' : 'Selamat datang kembali'}</CardTitle>
            <CardDescription>{register ? 'Daftar untuk mulai mencatat arus kas usahamu.' : 'Masuk untuk melihat kondisi keuangan usahamu.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              {error && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {register && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nama lengkap</Label>
                    <Input id="name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Nama pemilik" autoComplete="name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="business">Nama usaha</Label>
                    <Input id="business" required minLength={2} maxLength={100} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Contoh: Kopi Maju" />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" required type="password" minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" autoComplete={register ? 'new-password' : 'current-password'} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {busy ? 'Memproses...' : register ? 'Daftar' : 'Masuk'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {register ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                <Link to={register ? '/login' : '/register'} className="font-medium text-foreground underline-offset-4 hover:underline">
                  {register ? 'Masuk' : 'Daftar sekarang'}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-balance text-muted-foreground">
          UsahaCerdas mencatat keuangan berbasis kas. Laporan bukan pengganti akuntan.
        </p>
      </div>
    </div>
  );
}
