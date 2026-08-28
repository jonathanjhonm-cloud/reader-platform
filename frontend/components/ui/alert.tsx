'use client';

import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'success' | 'error';

const styles: Record<AlertVariant, { container: string; icon: string }> = {
  success: {
    container: 'border-emerald-400/20 bg-[#0d1b18]/95',
    icon: 'text-emerald-300',
  },
  error: {
    container: 'border-rose-400/20 bg-[#1c1117]/95',
    icon: 'text-rose-300',
  },
};

export function Alert({
  variant,
  title,
  description,
  onClose,
  className,
}: {
  variant: AlertVariant;
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}) {
  const Icon = variant === 'success' ? CheckCircle2 : CircleAlert;

  return <div
    role={variant === 'error' ? 'alert' : 'status'}
    aria-live={variant === 'error' ? 'assertive' : 'polite'}
    className={cn('flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-2xl backdrop-blur', styles[variant].container, className)}
  >
    <Icon size={19} className={cn('mt-0.5 shrink-0', styles[variant].icon)} />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-100">{title}</p>
      {description && <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>}
    </div>
    {onClose && <button type="button" onClick={onClose} aria-label="Fechar alerta" className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"><X size={15} /></button>}
  </div>;
}
