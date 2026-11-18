import { ChartNoAxesCombined } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ChartNoAxesCombined className="size-4" />
      </span>
      {!compact && <span>UsahaCerdas</span>}
    </span>
  );
}
