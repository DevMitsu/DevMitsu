import { Mail, Phone, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Modal, PageHeader, SearchBox, Tabs } from '../../components/ui';
import { attempt, confirmDialog, tryDo } from '../../components/toast';
import type { Person, Supplier } from '../../domain/types';
import { useScope, scopePath } from '../../lib/scope';
import { deletePerson, deleteSupplier, savePerson, saveSupplier } from '../../store/actions';
import { useStore } from '../../store/store';
import { useNavigate } from 'react-router-dom';

export function DirectoryPage() {
  const { which = 'people' } = useParams();
  const { scope } = useScope();
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader icon={which === 'people' ? 'eye' : 'package'} title="Directory" sub="Teachers, lab assistants and suppliers. Names here are offered as suggestions in every form, but you can always type someone new." />
      <Tabs tabs={[{ id: 'people', label: 'People' }, { id: 'suppliers', label: 'Suppliers' }]} value={which === 'suppliers' ? 'suppliers' : 'people'} onChange={(t) => navigate(scopePath(scope, `directory/${t}`))} />
      {which === 'suppliers' ? <Suppliers /> : <People />}
    </div>
  );
}

function People() {
  const people = useStore((s) => s.people);
  const roles = useStore((s) => s.lists.find((l) => l.id === 'roles')?.options ?? []);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Person | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const t = q.trim().toLowerCase();
  const list = people.filter((p) => !t || `${p.name} ${p.role} ${p.group ?? ''}`.toLowerCase().includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search people…" className="w-full sm:w-72" />
        <div className="ml-auto flex gap-2"><Button onClick={() => setBulk(true)}><Users className="h-4 w-4" /> Add several</Button><Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add person</Button></div>
      </div>
      <Card pad={false} className="overflow-x-auto">
        {list.length === 0 ? <EmptyState icon="eye" title="No people yet" action={<Button variant="primary" onClick={() => setBulk(true)}>Paste a list of names</Button>}>Add the teachers and lab assistants who use the labs.</EmptyState> : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Class / department</th><th>Contact</th><th /></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setEdit(p)} style={!p.active ? { opacity: 0.55 } : undefined}>
                <td className="font-medium">{p.name}{!p.active && <Badge className="ml-2">inactive</Badge>}</td>
                <td><Badge tone={p.role === 'Teacher' ? 'blue' : p.role === 'Lab assistant' ? 'teal' : 'gray'}>{p.role}</Badge></td>
                <td className="text-muted">{p.group ?? '—'}</td>
                <td className="text-muted"><span className="flex flex-wrap gap-x-3">{p.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}{p.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}</span></td>
                <td />
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      {edit && <PersonDialog person={edit === 'new' ? undefined : edit} roles={roles} onClose={() => setEdit(null)} />}
      {bulk && <BulkPeople roles={roles} onClose={() => setBulk(false)} />}
    </>
  );
}

function PersonDialog({ person, roles, onClose }: { person?: Person; roles: string[]; onClose: () => void }) {
  const [f, setF] = useState<Omit<Person, 'id'>>({ name: person?.name ?? '', role: person?.role ?? roles[0] ?? 'Teacher', group: person?.group ?? '', phone: person?.phone ?? '', email: person?.email ?? '', notes: person?.notes ?? '', active: person?.active ?? true });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const remove = async () => { if (person && await confirmDialog({ title: `Remove ${person.name}?`, body: 'Their name stays on entries they already made. Consider marking them inactive instead.', confirm: 'Remove', danger: true })) { tryDo(() => deletePerson(person.id), 'Removed'); onClose(); } };
  return (
    <Modal size="sm" title={person ? 'Edit person' : 'Add person'} onClose={onClose}
      footer={<>{person && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /></Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => tryDo(() => savePerson({ ...f, id: person?.id, group: f.group || undefined, phone: f.phone || undefined, email: f.email || undefined, notes: f.notes || undefined }), 'Saved') && onClose()}>Save</Button></>}>
      <div className="grid gap-3">
        <Field label="Name" required><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role"><select className="input" value={f.role} onChange={(e) => set('role', e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Class / department"><input className="input" value={f.group ?? ''} onChange={(e) => set('group', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        </div>
        <Field label="Notes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Checkbox checked={f.active} onChange={(v) => set('active', v)}>Active (offered in suggestions)</Checkbox>
      </div>
    </Modal>
  );
}

function BulkPeople({ roles, onClose }: { roles: string[]; onClose: () => void }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState(roles[0] ?? 'Teacher');
  const names = text.split(/\n/).map((x) => x.trim()).filter(Boolean);
  const add = () => {
    let n = 0;
    for (const name of names) if (tryDo(() => savePerson({ name, role, active: true }))) n++;
    attempt(() => undefined, `Added ${n} people`);
    onClose();
  };
  return (
    <Modal size="sm" title="Add several people" sub="One name per line." onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!names.length} onClick={add}>Add {names.length || ''}</Button></>}>
      <Field label="Role for all of them"><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="Names" className="mt-3"><textarea className="input min-h-40" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ms. R. Sharma\nMr. A. Verma'} /></Field>
    </Modal>
  );
}

function Suppliers() {
  const suppliers = useStore((s) => s.suppliers);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null);
  const t = q.trim().toLowerCase();
  const list = suppliers.filter((s) => !t || `${s.name} ${s.contact ?? ''} ${s.notes ?? ''}`.toLowerCase().includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search suppliers…" className="w-full sm:w-72" />
        <Button variant="primary" className="ml-auto" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add supplier</Button>
      </div>
      <Card pad={false} className="overflow-x-auto">
        {list.length === 0 ? <EmptyState icon="package" title="No suppliers yet" action={<Button variant="primary" onClick={() => setEdit('new')}>Add a supplier</Button>}>Keep contact details and what each supplier is good for.</EmptyState> : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Notes</th></tr></thead>
            <tbody>{list.map((s) => <tr key={s.id} className="clickable" onClick={() => setEdit(s)}><td className="font-medium">{s.name}</td><td>{s.contact ?? '—'}</td><td>{s.phone ?? '—'}</td><td>{s.email ?? '—'}</td><td className="max-w-xs truncate text-muted">{s.notes ?? ''}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
      {edit && <SupplierDialog supplier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [f, setF] = useState<Omit<Supplier, 'id'>>({ name: supplier?.name ?? '', contact: supplier?.contact ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', website: supplier?.website ?? '', address: supplier?.address ?? '', notes: supplier?.notes ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));
  const remove = async () => { if (supplier && await confirmDialog({ title: `Remove ${supplier.name}?`, body: 'Items and requirements that name this supplier keep the name.', confirm: 'Remove', danger: true })) { tryDo(() => deleteSupplier(supplier.id), 'Removed'); onClose(); } };
  const blank = (v?: string) => v?.trim() || undefined;
  return (
    <Modal size="sm" title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose}
      footer={<>{supplier && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /></Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => tryDo(() => saveSupplier({ id: supplier?.id, name: f.name, contact: blank(f.contact), phone: blank(f.phone), email: blank(f.email), website: blank(f.website), address: blank(f.address), notes: blank(f.notes) }), 'Saved') && onClose()}>Save</Button></>}>
      <div className="grid gap-3">
        <Field label="Name" required><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact person"><input className="input" value={f.contact ?? ''} onChange={(e) => set('contact', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Website"><input className="input" type="url" value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} /></Field>
        </div>
        <Field label="Address"><input className="input" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Notes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="What they supply, delivery time, account number…" /></Field>
      </div>
    </Modal>
  );
}
