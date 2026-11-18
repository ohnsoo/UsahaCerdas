import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TxTypeBadge } from '@/components/tx-type-badge';
import { dateLabel, isOutflow, labels, money, type Transaction } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  transactions: Transaction[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
};

function accountLabel(t: Transaction) {
  if (t.type === 'TRANSFER') return `${t.fromAccount?.name ?? '—'} → ${t.toAccount?.name ?? '—'}`;
  return t.account?.name ?? '—';
}

export function TxTable({ transactions, onEdit, onDelete }: Props) {
  const withActions = Boolean(onEdit || onDelete);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden w-28 sm:table-cell">Tanggal</TableHead>
          <TableHead>Keterangan</TableHead>
          <TableHead className="hidden md:table-cell">Jenis</TableHead>
          <TableHead className="hidden lg:table-cell">Akun</TableHead>
          <TableHead className="text-right">Nominal</TableHead>
          {withActions && <TableHead className="w-10"><span className="sr-only">Aksi</span></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(t => (
          <TableRow key={t.id}>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{dateLabel(t.date)}</TableCell>
            <TableCell className="whitespace-normal">
              <div className="font-medium">{t.note || t.category?.name || labels[t.type]}</div>
              {/* < md: kolom tanggal/jenis disembunyikan, jadi ringkasannya pindah ke sini */}
              <div className="text-xs text-muted-foreground md:hidden">
                <span className="sm:hidden">{dateLabel(t.date)} · </span>{t.category?.name ?? labels[t.type]}
              </div>
              {t.category?.name && t.note && <div className="hidden text-xs text-muted-foreground md:block">{t.category.name}</div>}
            </TableCell>
            <TableCell className="hidden md:table-cell"><TxTypeBadge type={t.type} /></TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">{accountLabel(t)}</TableCell>
            <TableCell className={cn('whitespace-nowrap text-right font-medium tabular',
              t.type === 'TRANSFER' ? 'text-muted-foreground' : isOutflow(t.type) ? 'text-expense' : 'text-income')}>
              {t.type === 'TRANSFER' ? '' : isOutflow(t.type) ? '−' : '+'}{money(t.amount)}
            </TableCell>
            {withActions && (
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Aksi transaksi"><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onSelect={() => onEdit(t)}><Pencil />Edit</DropdownMenuItem>}
                    {onEdit && onDelete && <DropdownMenuSeparator />}
                    {onDelete && <DropdownMenuItem variant="destructive" onSelect={() => onDelete(t)}><Trash2 />Hapus</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
