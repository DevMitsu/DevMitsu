import type { EffectiveSlot } from '../../domain/queries';

/** "9B", "9B + 9C" or "—" */
export const shortClasses = (ids: string[]) => (ids.length ? ids.join(' + ') : '—');

export const slotTag = (e: EffectiveSlot): { label: string; tone: 'neutral' | 'amber' | 'sage' } | null => {
  if (e.source === 'proxy') return { label: 'Proxy', tone: 'amber' };
  if (e.source === 'added') return { label: 'Added', tone: 'amber' };
  if (e.source === 'changed') return { label: 'Changed', tone: 'amber' };
  if (e.source === 'cancelled') return { label: 'Cancelled', tone: 'amber' };
  return null;
};
