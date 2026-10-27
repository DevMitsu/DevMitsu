import { Link } from 'react-router-dom';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { classIdOf, gradesFor, LIBRARIES, SECTIONS } from '../../domain/rules';
import { openLoansOf } from '../../domain/queries';
import { useStore } from '../../store/store';

/** Classwise entry point: pick a class to mark who is in the library and to issue or return books. */
export function EntriesPage() {
  const state = useStore((s) => s);
  const lib = state.activeLibrary;
  return (
    <div>
      <PageHeader title="Entries" description={`Choose a class to open its list. Showing the ${LIBRARIES[lib].label} classes. To find a person or book, use the search at the top.`}
        actions={<Link to="/students?tab=teachers" className="inline-flex h-10 items-center rounded-control border border-line bg-panel px-4 text-sm font-medium hover:bg-sage-soft">Teachers</Link>} />
      <div className="space-y-4">
        {gradesFor(lib).map((g) => (
          <Panel key={g}>
            <h2 className="border-b border-line bg-canvas px-4 py-2.5 text-sm font-semibold text-ink">Class {g}</h2>
            <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
              {SECTIONS.map((sec) => {
                const id = classIdOf(g, sec);
                const members = state.students.filter((s) => s.active && s.grade === g && s.section === sec);
                const held = members.reduce((n, s) => n + openLoansOf(state, { type: 'student', id: s.id }).length, 0);
                const pend = state.pending.filter((p) => !p.resolvedOn && p.borrowerType === 'student' && members.some((m) => m.id === p.borrowerId)).length;
                return (
                  <li key={id} className="bg-panel">
                    <Link to={`/class/${id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sage-soft">
                      <span className="grid size-11 shrink-0 place-items-center rounded-control bg-sage text-base font-semibold text-navy">{id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">Class {id}</span>
                        <span className="block text-xs text-muted">{members.length} students · {held} books out</span>
                      </span>
                      {pend > 0 && <Badge tone="amber">{pend} pending</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
