import React from 'react';
import { cn } from '@/lib/utils';

export function Progress({ value = 0, className, ...props }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} {...props}>
      <div className='h-full bg-slate-900 transition-all' style={{ width: `${v}%` }} />
    </div>
  );
}
