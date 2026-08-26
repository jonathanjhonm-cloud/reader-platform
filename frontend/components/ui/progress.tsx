import { cn } from '@/lib/utils';

export function Progress({ value, className }: { value: number; className?: string }) {
  return <div className={cn('h-1.5 overflow-hidden rounded-full bg-white/[0.08]', className)}><div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
