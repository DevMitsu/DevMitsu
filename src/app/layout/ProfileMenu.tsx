import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Settings, UserRound } from 'lucide-react';
import { initialsOf, mockProfile } from '../../config/profile';

const items = [
  { label: 'Profile', to: '/profile', icon: UserRound },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-control pr-2 pl-1.5 hover:bg-sage-soft"
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white"
        >
          {initialsOf(mockProfile.displayName)}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-medium text-ink">{mockProfile.displayName}</span>
          <span className="block text-[11px] text-muted">{mockProfile.role}</span>
        </span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <ul
          id={menuId}
          className="absolute right-0 z-20 mt-2 w-48 rounded-panel border border-line bg-panel p-1.5"
        >
          {items.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => setOpen(false)}
                className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-ink hover:bg-sage-soft"
              >
                <Icon className="size-4 text-muted" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
