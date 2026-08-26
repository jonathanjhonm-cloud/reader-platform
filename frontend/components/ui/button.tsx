import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
      secondary: 'bg-white/[0.07] text-slate-100 hover:bg-white/[0.12]',
      ghost: 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
      outline: 'border border-white/10 text-slate-200 hover:bg-white/[0.06]',
    },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-5', icon: 'h-9 w-9' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
