import { useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  /** false untuk aksi yang bisa dibatalkan (mis. arsip), tombolnya tidak merah. */
  destructive?: boolean;
  onConfirm: () => Promise<void>;
};

/** Dialog konfirmasi (pengganti window.confirm). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Hapus', busyLabel = 'Menghapus...', destructive = true, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async e => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); }
            }}
          >
            {busy ? busyLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
