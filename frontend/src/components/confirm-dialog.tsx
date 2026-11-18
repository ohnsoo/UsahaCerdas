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
  onConfirm: () => Promise<void>;
};

/** Dialog konfirmasi untuk aksi destruktif (pengganti window.confirm). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Hapus', onConfirm }: Props) {
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
            variant="destructive"
            disabled={busy}
            onClick={async e => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); }
            }}
          >
            {busy ? 'Menghapus...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
