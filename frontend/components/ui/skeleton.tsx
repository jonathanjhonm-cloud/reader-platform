import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md bg-white/[0.055]', className)} {...props} />;
}
