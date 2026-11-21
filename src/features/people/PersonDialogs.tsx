import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { notify } from '../../components/ui/toast';
import { sectionsOf } from '../../domain/rules';
import { enabledGrades } from '../../sync/config';
import { useStore } from '../../store/store';
import type { Student, Teacher } from '../../domain/types';
import { addStudent, addTeacher, bulkAddStudents, bulkAddTeachers, updateStudent, updateTeacher } from '../../store/actions';

const ALL_GRADES = enabledGrades;

export function StudentDialog({ open, onClose, student, defaults }: { open: boolean; onClose: () => void; student?: Student; defaults?: { grade?: number; section?: string } }) {
  const sectionMap = useStore((s) => s.sections);
  const [name, setName] = useState(student?.name ?? '');
  const [gr, setGr] = useState(student?.grNo ?? '');
  const [grade, setGrade] = useState(student?.grade ?? defaults?.grade ?? ALL_GRADES[0] ?? 6);
  const [section, setSection] = useState(student?.section ?? defaults?.section ?? 'A');
  const [errors, setErrors] = useState<string[]>([]);

  const save = () => {
    const res = student ? updateStudent(student.id, { name, grNo: gr.trim() || student.grNo, grade, section }) : addStudent({ name, grade, section, grNo: gr });
    if (!res.ok) return setErrors(res.errors);
    notify(res, student ? 'Student details saved.' : res.message);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={student ? 'Edit student' : 'Add student'} description={student ? undefined : 'A GR number is made automatically if you leave it blank.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{student ? 'Save' : 'Add student'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <ErrorList errors={errors} />
        <TextField label="Name" value={name} onChange={setName} autoFocus />
        <TextField label="GR no." value={gr} onChange={setGr} placeholder={student ? undefined : 'Automatic'} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Class" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{ALL_GRADES.map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
          <Select label="Section" value={section} onChange={(e) => setSection(e.target.value)}>{sectionsOf(sectionMap, grade).map((s) => <option key={s}>{s}</option>)}</Select>
        </div>
      </form>
    </Modal>
  );
}

export function TeacherDialog({ open, onClose, teacher }: { open: boolean; onClose: () => void; teacher?: Teacher }) {
  const [name, setName] = useState(teacher?.name ?? '');
  const [dept, setDept] = useState(teacher?.department ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const save = () => {
    const res = teacher ? updateTeacher(teacher.id, { name, department: dept }) : addTeacher({ name, department: dept });
    if (!res.ok) return setErrors(res.errors);
    notify(res, teacher ? 'Teacher details saved.' : res.message);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={teacher ? 'Edit teacher' : 'Add teacher'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{teacher ? 'Save' : 'Add teacher'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <ErrorList errors={errors} />
        <TextField label="Name" value={name} onChange={setName} autoFocus />
        <TextField label="Department (subject)" value={dept} onChange={setDept} placeholder="e.g. Mathematics" />
      </form>
    </Modal>
  );
}

/** One student per line: name, class, section, GR no. (GR no. optional). Example: Aarav Shah, 9, B */
export function BulkAddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sectionMap = useStore((s) => s.sections);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const [cls, setCls] = useState('');
  const [sec0, setSec0] = useState('');
  const fixed = cls !== '' && sec0 !== '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const body = /^(sr\.?\s*no|s\.?\s*no|roll|name|student)/i.test(lines[0] ?? '') ? lines.slice(1) : lines;
  const parsed = body.map((line) => {
    const cells = line.split(/[\t,]/).map((x) => x.trim());
    let name: string, grade: number, section: string, gr: string | undefined;
    if (fixed) {
      // One class per file: columns are name and optionally GR no. A leading serial or roll number is ignored.
      const rest = /^\d{1,3}$/.test(cells[0] ?? '') && cells.length > 1 ? cells.slice(1) : cells;
      [name = '', gr] = rest; grade = Number(cls); section = sec0;
    } else {
      const [n, g, sec, grNo] = cells; name = n ?? ''; grade = Number(g); section = (sec ?? '').toUpperCase(); gr = grNo;
    }
    const ok = !!name && ALL_GRADES.includes(grade) && !!section && sectionsOf(sectionMap, grade).includes(section.toUpperCase());
    return { line, name, grade, section: section.toUpperCase(), grNo: gr || undefined, ok };
  });
  const good = parsed.filter((p) => p.ok);

  const save = () => {
    const res = bulkAddStudents(good.map(({ name, grade, section, grNo }) => ({ name, grade, section, grNo })));
    setErrors(res.errors);
    if (res.ok && !res.errors.length) { notify(res); onClose(); } else if (res.ok) notify(res);
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Add many students" description={fixed ? 'One student per line: name, then GR no. if you have it. Paste straight from Excel.' : 'One student per line: name, class, section and optionally the GR no.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!good.length}>Add {good.length || ''} student{good.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-3">
        <ErrorList errors={errors} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[13px] font-medium">This list is for class
            <select value={cls} onChange={(e) => { setCls(e.target.value); setSec0(''); }} className="mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-2 text-sm font-normal"><option value="">Each line says its class</option>{ALL_GRADES.map((g) => <option key={g} value={g}>Class {g}</option>)}</select>
          </label>
          {cls !== '' && <label className="block text-[13px] font-medium">Section
            <select value={sec0} onChange={(e) => setSec0(e.target.value)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-2 text-sm font-normal"><option value="">Choose</option>{sectionsOf(sectionMap, Number(cls)).map((x) => <option key={x}>{x}</option>)}</select>
          </label>}
          <label className="block text-[13px] font-medium">Or open a file (CSV)
            <input type="file" accept=".csv,.txt,.tsv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then((t) => { setText(t); setErrors([]); }); }} className="mt-1.5 block w-full text-sm font-normal" />
          </label>
        </div>
        <label className="block text-[13px] font-medium">Student list
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} rows={8} placeholder={'Aarav Shah, 9, B\nDiya Mehta, 9, B, GR2001'} className="mt-1.5 w-full rounded-control border border-line bg-panel px-3 py-2 font-mono text-sm font-normal" />
        </label>
        {parsed.length > 0 && (
          <p className="text-[13px] text-muted">{good.length} of {parsed.length} lines are ready.{parsed.length - good.length > 0 && <> Lines to fix: {parsed.filter((p) => !p.ok).map((p) => `“${p.line}”`).join(', ')}</>}</p>
        )}
      </div>
    </Modal>
  );
}

/** One teacher per line: name, department. Example: Anita Sharma, English */
export function BulkTeachersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const rows = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [name, ...rest] = l.split(/[,\t]/); return { name: (name ?? '').trim(), department: rest.join(' ').trim() }; });
  return (
    <Modal open={open} onClose={onClose} title="Add many teachers" description="One teacher per line: name, then department (subject)."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!rows.length} onClick={() => { const r = bulkAddTeachers(rows); if (notify(r)) onClose(); }}>Add {rows.length || ''} teacher{rows.length === 1 ? '' : 's'}</Button></>}>
      <label className="block text-[13px] font-medium">Teacher list
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={'Anita Sharma, English\nRajesh Iyer, Mathematics'} className="mt-1.5 w-full rounded-control border border-line bg-panel px-3 py-2 font-mono text-sm font-normal" />
      </label>
    </Modal>
  );
}
