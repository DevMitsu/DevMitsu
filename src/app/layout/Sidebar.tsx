import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { navItems } from '../navigation';

interface SidebarProps {
  /** Mobile/tablet drawer state. Ignored on large screens, where the sidebar is persistent. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-navy/50 lg:hidden',
          open ? 'block' : 'hidden',
        )}
      />
      <aside
        id="primary-navigation"
        className={cn(
          'on-navy fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy transition-transform duration-150 lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-navy-line px-5 lg:hidden">
          <span className="font-display text-xl text-white">Alexandria</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-control text-navy-text hover:bg-navy-hover hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.08em] text-navy-text/70 uppercase">
            Dashboard
          </p>
          <ul className="space-y-0.5">
            {navItems.map(({ path, label, icon: Icon, tag }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sage text-navy'
                        : 'text-navy-text hover:bg-navy-hover hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn('size-[18px] shrink-0', isActive ? 'text-primary' : '')}
                        aria-hidden
                      />
                      <span>{label}</span>
                      {tag && (
                        <span
                          className={cn(
                            'ml-auto rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium',
                            isActive ? 'bg-white/70 text-primary' : 'bg-navy-line text-navy-text',
                          )}
                        >
                          {tag}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <p className="border-t border-navy-line px-6 py-4 text-xs leading-relaxed text-navy-text/80">
          Stage 1 prototype. Figures and schedules shown are illustrative.
        </p>
      </aside>
    </>
  );
}
