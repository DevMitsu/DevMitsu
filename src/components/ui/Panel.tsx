import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** White content surface with a subtle border. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('overflow-hidden rounded-panel border border-line bg-panel', className)}
      {...rest}
    />
  );
}
