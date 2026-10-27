import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Settings, UserRound } from 'lucide-react';
import { LIBRARIES } from '../../domain/rules';
import { useStore } from '../../store/store';

const items = [
  { label: 'Profile', to: '/profile', icon: UserRound },
  { label: 'Settings', to: '/settings', icon: Settings },
];
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

export function ProfileMenu() {
  const lib = useStore((s) => s.activeLibrary);
  const name = useStore((s) => s.names[lib]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)} className="flex h-10 items-center gap-2 rounded-control pr-2 pl-1.5 hover:bg-sage-soft">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">{initialsOf(name)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-32 truncate text-[13px] font-medium text-ink">{name}</span>
          <span className="block text-[11px] text-muted">{LIBRARIES[lib].label}</span>
        </span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <ul id={menuId} className="absolute right-0 z-20 mt-2 w-48 rounded-panel border border-line bg-panel p-1.5">
          {items.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <Link to={to} onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-ink hover:bg-sage-soft">
                <Icon className="size-4 text-muted" aria-hidden />{label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
