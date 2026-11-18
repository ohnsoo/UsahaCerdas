import { CalendarDays } from 'lucide-react';

/** Pemilih periode sederhana berbasis input date bawaan browser. */
export function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const input = 'h-8 min-w-0 flex-1 bg-transparent text-sm outline-none [color-scheme:light]';
  return (
    <div className="flex h-8 w-full items-center gap-2 rounded-lg border bg-background px-2.5 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:w-auto">
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      <input aria-label="Dari tanggal" type="date" value={from} max={to} onChange={e => e.target.value && onFrom(e.target.value)} className={input} />
      <span className="text-muted-foreground">–</span>
      <input aria-label="Sampai tanggal" type="date" value={to} min={from} onChange={e => e.target.value && onTo(e.target.value)} className={input} />
    </div>
  );
}
