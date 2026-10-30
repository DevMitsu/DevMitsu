import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LibraryBig } from 'lucide-react';
import { LIBRARIES } from '../../domain/rules';
import type { LibraryId } from '../../domain/types';
import { switchLibrary } from '../../store/actions';
import { useStore } from '../../store/store';
import { toast } from '../../components/ui/toast';
import { LibraryGate } from './LibraryGate';

export function LibrarySwitcher() {
  const active = useStore((s) => s.activeLibrary);
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState<LibraryId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex h-10 items-center gap-2 rounded-control border border-line bg-sage-soft px-3 text-[13px] font-medium text-strong hover:border-primary/40">
        <LibraryBig className="size-4 text-accent" aria-hidden />
        <span className="hidden sm:inline">{LIBRARIES[active].label}</span>
        <span className="sm:hidden">{LIBRARIES[active].short}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-2 w-56 rounded-panel border border-line bg-panel p-1.5">
          <li className="px-2.5 py-1.5 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Working in</li>
          {(['jr', 'sr'] as LibraryId[]).map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => { setOpen(false); if (l !== active) setGate(l); }}
                className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-ink hover:bg-sage-soft"
              >
                {l === active ? <Check className="size-4 text-accent" aria-hidden /> : <span className="size-4" />}
                {LIBRARIES[l].label}
                {l !== active && <span className="ml-auto text-xs text-muted">Password</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {gate && (
        <LibraryGate library={gate} open onClose={() => setGate(null)} onUnlocked={() => { switchLibrary(gate); toast(`Now working in the ${LIBRARIES[gate].label}.`); setGate(null); }} />
      )}
    </div>
  );
}
