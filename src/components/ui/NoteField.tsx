import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../../store/store';
import type { NoteCategory } from '../../domain/types';

export const OTHER = '__other__';
export interface NoteValue { choice: string; other: string }
export const emptyNote = (): NoteValue => ({ choice: '', other: '' });
export const noteText = (v: NoteValue) => (v.choice === OTHER ? v.other.trim() : v.choice);

/** A note picked from the librarian's list of options, or typed manually under "Other". */
export function NoteField({ category, value, onChange, label = 'Note', required }: { category: NoteCategory; value: NoteValue; onChange: (v: NoteValue) => void; label?: string; required?: boolean }) {
  const options = useStore((s) => s.settings.notes[category]);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}{required && <span className="text-muted"> (required)</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value.choice}
          onChange={(e) => onChange({ ...value, choice: e.target.value })}
          className="h-10 w-full appearance-none rounded-control border border-line bg-panel pr-9 pl-3 text-sm text-ink hover:border-primary/40"
        >
          <option value="">Choose a note…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other (type below)</option>
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {value.choice === OTHER && (
        <input
          type="text"
          value={value.other}
          onChange={(e) => onChange({ ...value, other: e.target.value })}
          aria-label={`${label}, typed`}
          placeholder="Type the note"
          className="mt-2 h-10 w-full rounded-control border border-line bg-panel px-3 text-sm text-ink placeholder:text-muted hover:border-primary/40"
        />
      )}
    </div>
  );
}
