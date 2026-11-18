import { useEffect, useState } from 'react';
import { CircleAlert, Info, PieChart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DateRange } from '@/components/date-range';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { SummarySkeleton } from '@/pages/dashboard';
import { useLiveTick } from '@/lib/live';
import { api, dateLabel, localDate, money, startOfMonth, type Summary } from '@/lib/api';
import { cn } from '@/lib/utils';

function Line({ label, value, negative, strong }: { label: string; value: string; negative?: boolean; strong?: boolean }) {
  const n = Number(value);
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2.5 text-sm', strong && 'font-semibold')}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={cn('tabular', strong && n < 0 && 'text-expense')}>{negative && n !== 0 ? '−' : ''}{money(value)}</span>
    </div>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(localDate());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const live = useLiveTick(['transactions', 'accounts', 'categories']);

  useEffect(() => {
    let cancelled = false;
    api<Summary>(`/reports?from=${from}&to=${to}`)
      .then(x => { if (!cancelled) { setSummary(x); setError(''); } })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [from, to, live]);

  const totalExpense = Number(summary?.expense ?? 0);
  return (
    <>
      <PageHeader title="Laporan" description="Ringkasan arus kas dan surplus operasional per periode."
        actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />} />
      {error && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
      <Alert>
        <Info />
        <AlertDescription>Laporan ini memakai basis kas. Surplus belum mencakup HPP/persediaan, penyusutan, pajak, utang, atau piutang.</AlertDescription>
      </Alert>
      {!summary ? <SummarySkeleton /> : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan periode</CardTitle>
              <CardDescription>{dateLabel(from)} – {dateLabel(to)}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Operasional</p>
              <Line label="Pemasukan operasional" value={summary.income} />
              <Line label="Pengeluaran operasional" value={summary.expense} negative />
              <Separator />
              <Line label="Surplus operasional (kas)" value={summary.operatingSurplus} strong />
              <p className="pt-5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Pemilik</p>
              <Line label="Setoran modal" value={summary.capital} />
              <Line label="Prive / pengambilan pemilik" value={summary.draws} negative />
              <Separator />
              <Line label="Perubahan kas periode" value={summary.netCashMovement} strong />
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-3 text-sm">
                <span className="text-muted-foreground">Saldo kas per {dateLabel(to)}</span>
                <span className="font-semibold tabular">{money(summary.cashBalance)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pengeluaran per kategori</CardTitle>
              <CardDescription>Dari pengeluaran operasional periode ini</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.expenseCategories.length ? (
                <div className="space-y-4">
                  {summary.expenseCategories.map(c => {
                    const pct = totalExpense > 0 ? Math.min(100, (Number(c.amount) / totalExpense) * 100) : 0;
                    return (
                      <div key={c.name} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className="shrink-0 tabular"><span className="mr-2 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>{money(c.amount)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-expense/80" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={PieChart} title="Belum ada pengeluaran" description="Pengeluaran operasional pada periode ini akan dirinci di sini." />}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
