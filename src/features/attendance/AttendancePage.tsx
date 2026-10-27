import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { studentsOfClass, libraryOfClassId } from '../../domain/queries';
import { formatDate, LIBRARIES } from '../../domain/rules';
import { periodById, formatRange } from '../../domain/schedule';
import { useStore } from '../../store/store';

export function AttendancePage() {
  const state = useStore((s) => s);
  const [cls, setCls] = useState('all');
  const sessions = useMemo(() => Object.entries(state.presence).map(([key, marks]) => {
    const [date, classId, slot] = key.split('|') as [string, string, string];
    const total = studentsOfClass(state, classId).length;
    const present = Object.values(marks).filter((v) => v === 'present').length;
    const absent = Object.values(marks).filter((v) => v === 'absent').length;
    return { key, date, classId, slot, total, present, absent };
  }).filter((x) => x.present + x.absent > 0).sort((a, b) => b.date.localeCompare(a.date) || a.classId.localeCompare(b.classId)), [state]);
  const classes = [...new Set(sessions.map((s) => s.classId))].sort();
  const list = sessions.filter((s) => cls === 'all' || s.classId === cls);

  return (
    <div>
      <PageHeader title="Attendance" description="Who was in the library, as marked on each class page. This is not school attendance: a student can be in school but not in the library." />
      <div className="mb-4"><Select label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="w-40"><option value="all">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</Select></div>
      <Panel>
        {list.length === 0 ? (
          <div className="px-5 py-14 text-center"><p className="text-sm font-medium">No attendance marked yet.</p><p className="mt-1 text-sm text-muted">Open a class from Entries or the timetable and mark who is in the library.</p><Link to="/entries" className="mt-3 inline-block text-sm font-medium text-primary underline">Go to Entries</Link></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 font-medium">Class</th><th className="px-3 py-2.5 font-medium">Lecture</th><th className="px-3 py-2.5 font-medium">In library</th><th className="px-3 py-2.5 font-medium">Absent</th><th className="px-3 py-2.5 font-medium">Not marked</th></tr></thead>
            <tbody>{list.map((x) => { const p = periodById(x.slot); const lib = libraryOfClassId(x.classId); return (
              <tr key={x.key} className="border-b border-line last:border-b-0 hover:bg-sage-soft/50">
                <td className="px-4 py-2.5">{formatDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td className="px-3 py-2.5"><Link to={`/class/${x.classId}?date=${x.date}&slot=${x.slot}`} className="font-medium hover:text-primary hover:underline">{x.classId}</Link><span className="ml-1.5 text-xs text-muted">{lib && LIBRARIES[lib].short}</span></td>
                <td className="px-3 py-2.5 text-muted">{p ? `${p.label} · ${formatRange(p)}` : 'Library visit'}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.present}</td><td className="px-3 py-2.5 tabular-nums">{x.absent}</td><td className="px-3 py-2.5 tabular-nums">{Math.max(0, x.total - x.present - x.absent)}</td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
