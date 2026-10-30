import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { notify } from '../../components/ui/toast';
import { gradesFor, LIBRARIES, sectionsOf } from '../../domain/rules';
import type { LibraryId } from '../../domain/types';
import { addSection, removeSection } from '../../store/actions';
import { useStore } from '../../store/store';

/** Add a new section (such as 8E) at any time, or remove an empty one. */
export function ClassesSections() {
  const state = useStore((s) => s);
  const [letter, setLetter] = useState<Record<number, string>>({});
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(['jr', 'sr'] as LibraryId[]).map((lib) => (
        <div key={lib}>
          <h3 className="mb-2 text-sm font-semibold">{LIBRARIES[lib].label}</h3>
          <ul className="divide-y divide-line rounded-control border border-line">
            {gradesFor(lib).map((g) => (
              <li key={g} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-16 text-sm font-medium">Class {g}</span>
                <ul className="flex flex-1 flex-wrap gap-1.5">
                  {sectionsOf(state.sections, g).map((sec) => {
                    const n = state.students.filter((s) => s.active && s.grade === g && s.section === sec).length;
                    return (
                      <li key={sec} className="inline-flex items-center gap-1 rounded-control border border-line bg-canvas py-0.5 pr-0.5 pl-2 text-[13px]">
                        {g}{sec}<span className="text-xs text-muted">{n}</span>
                        <button type="button" aria-label={`Remove class ${g}${sec}`} onClick={() => notify(removeSection(g, sec))} className="grid size-5 place-items-center rounded text-muted hover:bg-sage hover:text-ink"><X className="size-3.5" aria-hidden /></button>
                      </li>
                    );
                  })}
                </ul>
                <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (notify(addSection(g, letter[g] ?? ''))) setLetter({ ...letter, [g]: '' }); }}>
                  <input aria-label={`New section for class ${g}`} maxLength={1} value={letter[g] ?? ''} onChange={(e) => setLetter({ ...letter, [g]: e.target.value.toUpperCase() })} placeholder="E" className="h-8 w-10 rounded-control border border-line bg-panel text-center text-sm uppercase" />
                  <Button type="submit" size="sm" icon={<Plus className="size-3.5" aria-hidden />} aria-label={`Add section to class ${g}`}>Add</Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
