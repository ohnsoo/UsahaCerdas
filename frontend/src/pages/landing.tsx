import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ChartColumnIncreasing, Landmark, ReceiptText, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useAuth } from '@/lib/auth';

const features = [
  { icon: ReceiptText, title: 'Catat dalam hitungan detik', text: 'Pemasukan, pengeluaran, modal, prive, dan transfer antar rekening dalam satu formulir.' },
  { icon: Landmark, title: 'Uang usaha dan pribadi terpisah', text: 'Setoran modal dan prive tidak tercampur ke pendapatan atau biaya operasional.' },
  { icon: ChartColumnIncreasing, title: 'Laporan kas siap baca', text: 'Saldo, surplus operasional, dan pengeluaran per kategori untuk periode apa pun.' },
];

/** Cuplikan dashboard dengan data contoh (bukan data pengguna). */
const sample = [
  { label: 'Saldo kas', value: 'Rp 24.750.000' },
  { label: 'Pemasukan', value: 'Rp 18.500.000', tone: 'text-income' },
  { label: 'Pengeluaran', value: 'Rp 8.200.000', tone: 'text-expense' },
];
const bars = [38, 52, 44, 63, 57, 71, 66, 82, 74, 90, 79, 96];

export default function Landing() {
  const { session } = useAuth();
  if (session) return <Navigate to="/app" replace />;
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link to="/login">Masuk</Link></Button>
            <Button asChild><Link to="/register">Daftar</Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center md:px-6 md:pt-24">
          <Badge variant="outline" className="mb-6 h-6 gap-1.5 px-2.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-income" /> Pencatatan kas untuk UMKM
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Keuangan usaha yang jelas, tanpa ribet spreadsheet.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-pretty md:text-lg">
            Catat uang masuk dan keluar, pantau saldo setiap rekening, dan lihat surplus operasional usahamu kapan saja.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Button size="lg" asChild><Link to="/register">Mulai gratis <ArrowRight data-icon="inline-end" /></Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">Saya sudah punya akun</Link></Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="rounded-xl border bg-muted/40 p-2 shadow-sm">
            <div className="rounded-lg border bg-background p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ringkasan November</p>
                  <p className="text-xs text-muted-foreground">Contoh tampilan dengan data simulasi</p>
                </div>
                <Badge variant="secondary">Contoh</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {sample.map(s => (
                  <div key={s.label} className="rounded-lg border p-4 text-left">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`mt-1 text-lg font-semibold tabular ${s.tone ?? ''}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-32 items-end gap-1.5 rounded-lg border p-4 md:h-44 md:gap-2.5" aria-hidden>
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-primary/80" style={{ height: `${h}%`, opacity: 0.35 + (i / bars.length) * 0.65 }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-20 md:grid-cols-3 md:px-6">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="shadow-none">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                  <Icon className="size-4" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center md:px-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Mulai rapikan catatan usahamu hari ini.</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> Data setiap usaha terpisah dan hanya bisa diakses pemiliknya.</p>
            </div>
            <Button size="lg" asChild><Link to="/register">Buat akun <ArrowRight data-icon="inline-end" /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between md:px-6">
          <span>© {new Date().getFullYear()} UsahaCerdas v0.1</span>
          <span>Laporan berbasis kas, bukan pengganti akuntan.</span>
        </div>
      </footer>
    </div>
  );
}
