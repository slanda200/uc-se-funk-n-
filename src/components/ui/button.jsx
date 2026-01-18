import React from 'react';
import { cn } from '@/lib/utils';

export function Button({
  className,
  variant = 'default',
  asChild = false,
  ...props
}) {
  const Comp = asChild ? 'span' : 'button';

  const base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/40 disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
    outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700',
  };

  return (
    <Comp
      className={cn(base, variants[variant] || variants.default, className)}
      {...props}
    />
  );
}
