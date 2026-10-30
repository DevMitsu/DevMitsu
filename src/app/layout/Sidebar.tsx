import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useStore } from '../../store/store';
import { isNavActive, navItems } from '../navigation';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const pending = useStore((s) => s.pending);
  const pendingCount = pending.filter((p) => !p.resolvedOn).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div aria-hidden onClick={onClose} className={cn('fixed inset-0 z-30 bg-navy/50 lg:hidden', open ? 'block' : 'hidden')} />
      <aside
        id="primary-navigation"
        className={cn(
          'on-navy fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy transition-transform duration-150 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-navy-line px-5 lg:hidden">
          <span className="font-display text-xl text-white">Alexandria</span>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="grid size-9 place-items-center rounded-control text-navy-text hover:bg-navy-hover hover:text-white">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.08em] text-navy-text/70 uppercase">Dashboard</p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = isNavActive(item, pathname);
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
                      active ? 'bg-sage text-on-sage' : 'text-navy-text hover:bg-navy-hover hover:text-white',
                    )}
                  >
                    <Icon className={cn('size-[18px] shrink-0', active && 'text-accent')} aria-hidden />
                    <span>{item.label}</span>
                    {item.tag && (
                      <span className={cn('ml-auto rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium', active ? 'bg-canvas/50 text-accent' : 'bg-navy-line text-navy-text')}>{item.tag}</span>
                    )}
                    {item.badge === 'pending' && pendingCount > 0 && (
                      <span aria-label={`${pendingCount} pending`} className="ml-auto rounded-[4px] bg-amber-soft px-1.5 py-0.5 text-[11px] font-semibold text-ink tabular-nums">{pendingCount}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className="border-t border-navy-line px-6 py-4 text-xs leading-relaxed text-navy-text/80">
          Prototype with dummy data. Nothing here is a real school record.
        </p>
      </aside>
    </>
  );
}
