import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, WalletMinimal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { labels, type TxType } from '@/lib/api';
import { cn } from '@/lib/utils';

const styles: Record<TxType, { className: string; icon: typeof ArrowDownLeft }> = {
  INCOME: { className: 'bg-income/10 text-income', icon: ArrowDownLeft },
  EXPENSE: { className: 'bg-expense/10 text-expense', icon: ArrowUpRight },
  CAPITAL: { className: 'bg-capital/10 text-capital', icon: Landmark },
  DRAW: { className: 'bg-draw/10 text-draw', icon: WalletMinimal },
  TRANSFER: { className: 'bg-muted text-muted-foreground', icon: ArrowLeftRight },
};

export function TxTypeBadge({ type }: { type: TxType }) {
  const { className, icon: Icon } = styles[type];
  return (
    <Badge variant="secondary" className={cn('gap-1 font-medium', className)}>
      <Icon data-icon="inline-start" />
      {labels[type]}
    </Badge>
  );
}
