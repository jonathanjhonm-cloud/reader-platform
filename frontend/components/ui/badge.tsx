import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('inline-flex w-fit items-center rounded-md bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-300', className)} {...props} />; }
