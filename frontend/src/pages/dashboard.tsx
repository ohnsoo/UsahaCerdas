import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CircleAlert, CreditCard, Info, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from '@/components/date-range';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TxTable } from '@/components/tx-table';
import { api, compactMoney, dateLabel, localDate, money, startOfMonth, type Summary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveTick } from '@/lib/live';
import { cn } from '@/lib/utils';

const monthName = (ym: string) => new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(new Date(ym + '-01T00:00:00Z'));

function StatCard({ title, value, icon: Icon, hint, tone }: { title: string; value: string; icon: typeof Wallet; hint: string; tone?: string }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction><Icon className="size-4 text-muted-foreground" /></CardAction>
        <CardTitle className={cn('text-2xl font-semibold tabular', tone)}>{money(value)}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

export function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(localDate());
  const live = useLiveTick(['transactions', 'accounts', 'categories']);

  useEffect(() => {
    let cancelled = false;
    api<Summary>(`/dashboard?from=${from}&to=${to}`)
      .then(d => { if (!cancelled) { setSummary(d); setError(''); } })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [from, to, live]);

  const surplus = Number(summary?.operatingSurplus ?? 0);
  return (
    <>
      <PageHeader
        title={`Halo, ${session?.user.name.split(' ')[0] ?? ''}`}
        description="Ringkasan keuangan usahamu pada periode terpilih."
        actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      />
      {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      {!summary ? <SummarySkeleton /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Saldo kas" value={summary.cashBalance} icon={Wallet} hint={`Posisi per ${dateLabel(to)}`} />
            <StatCard title="Pemasukan operasional" value={summary.income} icon={ArrowDownLeft} hint="Periode terpilih" />
            <StatCard title="Pengeluaran operasional" value={summary.expense} icon={ArrowUpRight} hint="Periode terpilih" />
            <StatCard title="Surplus operasional" value={summary.operatingSurplus} icon={TrendingUp} hint="Pemasukan − pengeluaran (basis kas)"
              tone={surplus < 0 ? 'text-expense' : surplus > 0 ? 'text-income' : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Arus kas operasional</CardTitle>
                <CardDescription>Pemasukan dan pengeluaran 6 bulan terakhir</CardDescription>
                <CardAction className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-income" />Pemasukan</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-expense" />Pengeluaran</span>
                </CardAction>
              </CardHeader>
              <CardContent className="h-64 px-2 sm:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--income)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--income)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--expense)" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="var(--expense)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="var(--muted-foreground)" />
                    <YAxis width={56} tickFormatter={v => compactMoney(Number(v))} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                    <Tooltip
                      cursor={{ stroke: 'var(--border)' }}
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)' }}
                      labelFormatter={m => monthName(String(m))}
                      formatter={v => money(Number(v))}
                    />
                    <Area type="monotone" dataKey="income" name="Pemasukan" stroke="var(--income)" strokeWidth={2} fill="url(#fillIncome)" />
                    <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="var(--expense)" strokeWidth={2} fill="url(#fillExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rekening kas</CardTitle>
                <CardDescription>Saldo per {dateLabel(to)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {/* Rekening arsip bersaldo nol tidak perlu tampil; yang masih bersaldo tetap ditampilkan agar total kas bisa ditelusuri. */}
                {summary.accountBalances.filter(a => !a.archived || Number(a.balance) !== 0).map(a => (
                  <div key={a.id} className="flex items-center gap-3 rounded-md py-2">
                    <div className="flex size-8 items-center justify-center rounded-md border bg-muted/50"><CreditCard className="size-4 text-muted-foreground" /></div>
                    <span className="min-w-0 flex-1 truncate text-sm">{a.name}{a.archived && <span className="ml-1.5 text-xs text-muted-foreground">(arsip)</span>}</span>
                    <span className={cn('text-sm font-medium tabular', Number(a.balance) < 0 && 'text-expense')}>{money(a.balance)}</span>
                  </div>
                ))}
                <div className="mt-3 flex gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Modal dan prive mengubah saldo, tetapi tidak dihitung sebagai pendapatan atau biaya operasional.
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaksi terbaru</CardTitle>
              <CardDescription>Lima aktivitas terakhir pada periode ini</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" asChild><Link to="/app/transactions">Lihat semua <ArrowRight data-icon="inline-end" /></Link></Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {summary.recentTransactions.length
                ? <TxTable transactions={summary.recentTransactions} />
                : <EmptyState icon={ReceiptText} title="Belum ada transaksi" description="Transaksi pada periode ini akan muncul di sini."
                    action={<Button size="sm" asChild><Link to="/app/transactions">Tambah transaksi</Link></Button>} />}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
