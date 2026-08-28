'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11151d] p-5 shadow-2xl">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-400/10 text-rose-300"><TriangleAlert size={19} /></span>
          <div>
            <h2 id="confirm-title" className="text-base font-semibold text-slate-100">{title}</h2>
            <p id="confirm-description" className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={loading} onClick={onConfirm} className="bg-rose-500 text-white hover:bg-rose-400">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Excluindo…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
