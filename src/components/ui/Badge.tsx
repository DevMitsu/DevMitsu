import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'sage' | 'green' | 'amber' | 'navy';
const tones: Record<Tone, string> = {
  neutral: 'border border-line bg-canvas text-muted',
  sage: 'bg-sage text-navy',
  green: 'bg-primary text-white',
  amber: 'border border-amber/50 bg-amber-soft text-ink',
  navy: 'bg-navy text-white',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
