import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { gradesFor, LIBRARIES, libraryForGrade, norm, SECTIONS } from '../../domain/rules';
import { openLoansOf } from '../../domain/queries';
import { useStore } from '../../store/store';
import { BulkAddDialog, StudentDialog, TeacherDialog } from './PersonDialogs';

type Tab = 'students' | 'teachers';
const PAGE = 40;

export function StudentsPage() {
  const [sp, setSp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'teachers' ? 'teachers' : 'students';
  const state = useStore((s) => s);
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('all');
  const [section, setSection] = useState('all');
  const [page, setPage] = useState(0);
  const [dlg, setDlg] = useState<null | 'student' | 'teacher' | 'bulk'>(null);

  const students = useMemo(() => state.students.filter((s) => s.active && (grade === 'all' || s.grade === Number(grade)) && (section === 'all' || s.section === section) && (!q || norm(`${s.name} ${s.grNo}`).includes(norm(q)))).sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section) || a.name.localeCompare(b.name)), [state.students, q, grade, section]);
  const teachers = useMemo(() => state.teachers.filter((t) => t.active && (!q || norm(`${t.name} ${t.department}`).includes(norm(q)))), [state.teachers, q]);
  const pages = Math.max(1, Math.ceil(students.length / PAGE));
  const shown = students.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div>
      <PageHeader title="Students" description="Students and teachers who can borrow books."
        actions={tab === 'students' ? (<><Button icon={<Upload className="size-4" aria-hidden />} onClick={() => setDlg('bulk')}>Add many</Button><Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDlg('student')}>Add student</Button></>) : <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDlg('teacher')}>Add teacher</Button>} />
      <Tabs<Tab> label="People" value={tab} onChange={(t) => { setSp(t === 'teachers' ? { tab: 'teachers' } : {}); setQ(''); }} tabs={[{ value: 'students', label: 'Students', count: state.students.filter((s) => s.active).length }, { value: 'teachers', label: 'Teachers', count: state.teachers.filter((t) => t.active).length }]} />
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="block text-[13px] font-medium">Search<input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={tab === 'students' ? 'Name or GR no.' : 'Name or department'} className="mt-1.5 block h-10 w-64 rounded-control border border-line bg-panel px-3 text-sm font-normal hover:border-primary/40" /></label>
        {tab === 'students' && (<>
          <Select label="Class" value={grade} onChange={(e) => { setGrade(e.target.value); setPage(0); }} className="w-36"><option value="all">All</option>{[...gradesFor('jr'), ...gradesFor('sr')].map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
          <Select label="Section" value={section} onChange={(e) => { setSection(e.target.value); setPage(0); }} className="w-32"><option value="all">All</option>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</Select>
          <p className="pb-2.5 text-sm text-muted">{students.length} students</p>
        </>)}
      </div>

      <Panel>
        {tab === 'students' ? (shown.length === 0 ? <p className="px-5 py-12 text-center text-sm text-muted">No student matches. Try another search, or add the student.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">GR no.</th><th className="px-3 py-2.5 font-medium">Class</th><th className="px-3 py-2.5 font-medium">Library</th><th className="px-3 py-2.5 font-medium">Books held</th></tr></thead>
            <tbody>{shown.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-sage-soft/50">
                <td className="px-4 py-2.5"><Link to={`/student/${s.id}`} className="font-medium text-ink hover:text-primary hover:underline">{s.name}</Link></td>
                <td className="px-3 py-2.5 text-muted tabular-nums">{s.grNo}</td><td className="px-3 py-2.5">{s.grade}{s.section}</td>
                <td className="px-3 py-2.5"><Badge>{LIBRARIES[libraryForGrade(s.grade)].short}</Badge></td>
                <td className="px-3 py-2.5 tabular-nums">{openLoansOf(state, { type: 'student', id: s.id }).length}</td>
              </tr>))}</tbody>
          </table></div>
        )) : (teachers.length === 0 ? <p className="px-5 py-12 text-center text-sm text-muted">No teacher yet. Add one with the button above.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="px-4 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Department</th><th className="px-3 py-2.5 font-medium">Books held</th></tr></thead>
            <tbody>{teachers.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-sage-soft/50"><td className="px-4 py-2.5"><Link to={`/teacher/${t.id}`} className="font-medium text-ink hover:text-primary hover:underline">{t.name}</Link></td><td className="px-3 py-2.5 text-muted">{t.department}</td><td className="px-3 py-2.5 tabular-nums">{openLoansOf(state, { type: 'teacher', id: t.id }).length}</td></tr>))}</tbody>
          </table></div>
        ))}
        {tab === 'students' && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-muted">
            <span>Page {page + 1} of {pages}</span>
            <span className="flex gap-2"><Button size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Previous</Button><Button size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>Next</Button></span>
          </div>
        )}
      </Panel>
      {dlg === 'student' && <StudentDialog open onClose={() => setDlg(null)} />}
      {dlg === 'teacher' && <TeacherDialog open onClose={() => setDlg(null)} />}
      {dlg === 'bulk' && <BulkAddDialog open onClose={() => setDlg(null)} />}
    </div>
  );
}
