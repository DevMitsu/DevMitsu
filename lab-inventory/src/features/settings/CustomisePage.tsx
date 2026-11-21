import { ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon, ICONS } from '../../components/icons';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Modal, PageHeader, Tabs, cx } from '../../components/ui';
import { attempt, confirmDialog, tryDo } from '../../components/toast';
import { LAB_COLORS } from '../../domain/defaults';
import { activeLabs } from '../../domain/inventory';
import type { Category, Lab, ListDef, ModuleDef, Tone } from '../../domain/types';
import { scopePath, useScope } from '../../lib/scope';
import { deleteCategory, deleteList, deleteLab, deleteModule, moveModule, saveCategory, saveLab, saveList, saveModule, setLabLocations, updateSettings } from '../../store/actions';
import { useStore } from '../../store/store';
import { DataTab } from './DataTab';
import { FieldsEditor } from './FieldsEditor';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'labs', label: 'Labs' },
  { id: 'categories', label: 'Item categories' },
  { id: 'forms', label: 'Forms & logs' },
  { id: 'lists', label: 'Lists' },
  { id: 'rules', label: 'Alerts & rules' },
  { id: 'data', label: 'Data & backup' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function CustomisePage() {
  const { tab = 'general' } = useParams();
  const { scope } = useScope();
  const navigate = useNavigate();
  const t = (TABS.some((x) => x.id === tab) ? tab : 'general') as Tab;
  return (
    <div>
      <PageHeader icon="wrench" title="Customise" sub="Make the app fit your school: rename labs, add item categories with their own fields, change what each form asks, edit every drop-down list, or create entirely new logs." />
      <Tabs tabs={TABS.map((x) => ({ id: x.id, label: x.label }))} value={t} onChange={(id) => navigate(scopePath(scope, `customise/${id}`))} />
      {t === 'general' && <General />}
      {t === 'labs' && <LabsTab />}
      {t === 'categories' && <CategoriesTab />}
      {t === 'forms' && <FormsTab />}
      {t === 'lists' && <ListsTab />}
      {t === 'rules' && <RulesTab />}
      {t === 'data' && <DataTab />}
    </div>
  );
}

// ------------------------------------------------------------ small shared pieces

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
      {Object.keys(ICONS).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={k} onClick={() => onChange(k)} className={cx('grid h-8 w-8 place-items-center rounded-lg border', value === k ? 'border-accent bg-accent-soft text-accent' : 'text-muted hover:bg-surface2')}><Icon name={k} /></button>
      ))}
    </div>
  );
}

function LabChecks({ value, onChange, labs }: { value: string[]; onChange: (v: string[]) => void; labs: Lab[] }) {
  const all = value.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Checkbox checked={all} onChange={(on) => onChange(on ? [] : labs.map((l) => l.id))}>Every lab</Checkbox>
      {!all && labs.map((l) => <Checkbox key={l.id} checked={value.includes(l.id)} onChange={(on) => { const n = on ? [...value, l.id] : value.filter((x) => x !== l.id); onChange(n.length ? n : []); }}>{l.name}</Checkbox>)}
    </div>
  );
}

// ------------------------------------------------------------ General

function General() {
  const s = useStore((x) => x.settings);
  const [school, setSchool] = useState(s.schoolName);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold">School</h2>
        <div className="grid gap-3">
          <Field label="School name" help="Shown at the top and on printed reports"><input className="input" value={school} onChange={(e) => setSchool(e.target.value)} onBlur={() => updateSettings({ schoolName: school.trim() || s.schoolName })} /></Field>
          <Field label="Currency symbol"><input className="input w-24" value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value })} maxLength={4} /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Appearance</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Theme"><select className="input" value={s.theme} onChange={(e) => updateSettings({ theme: e.target.value as never })}><option value="system">Match my device</option><option value="light">Light</option><option value="dark">Dark</option></select></Field>
          <Field label="Text size"><select className="input" value={s.textSize} onChange={(e) => updateSettings({ textSize: e.target.value as never })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></Field>
          <div className="sm:col-span-2"><Checkbox checked={s.compact} onChange={(v) => updateSettings({ compact: v })}>Compact tables (more rows on screen)</Checkbox></div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Stock rules</h2>
        <div className="grid gap-3">
          <Field label="Item code pattern" help="Tokens: {LAB} = lab code, {CAT} = category prefix, {NNNN} = running number. Example result: CHE-RGT-0007"><input className="input font-mono" value={s.codeFormat} onChange={(e) => updateSettings({ codeFormat: e.target.value })} /></Field>
          <Checkbox checked={s.allowNegativeStock} onChange={(v) => updateSettings({ allowNegativeStock: v })}>Allow stock to go below zero (otherwise using more than is in stock is refused)</Checkbox>
          <Field label="Suggested fine for breakage" help="As a percentage of the item's cost. 100 = the full replacement cost. You can always change the amount on each entry."><div className="flex items-center gap-2"><input className="input w-24" type="number" min="0" max="500" value={s.finePercent} onChange={(e) => updateSettings({ finePercent: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-sm text-muted">% of cost</span></div></Field>
          <Field label="Days equipment is lent for, by default"><input className="input w-24" type="number" min="1" value={s.loanDefaultDays} onChange={(e) => updateSettings({ loanDefaultDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------ Labs

function LabsTab() {
  const labs = useStore((s) => s.labs);
  const items = useStore((s) => s.items);
  const [edit, setEdit] = useState<Lab | 'new' | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add a lab</Button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {labs.map((l) => (
          <Card key={l.id} className={cx(l.archived && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: l.color }}><Icon name={l.icon} className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="font-semibold">{l.name} {l.archived && <Badge>archived</Badge>}</h3><p className="text-xs text-muted">{l.short} · {items.filter((i) => i.labId === l.id).length} items · {l.locations.length} locations{l.room ? ` · ${l.room}` : ''}</p></div>
              <Button size="sm" onClick={() => setEdit(l)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && <LabDialog lab={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function LabDialog({ lab, onClose }: { lab?: Lab; onClose: () => void }) {
  const labs = useStore((s) => s.labs);
  const [f, setF] = useState({ name: lab?.name ?? '', short: lab?.short ?? '', color: lab?.color ?? LAB_COLORS[labs.length % LAB_COLORS.length], icon: lab?.icon ?? 'beaker', room: lab?.room ?? '', incharge: lab?.incharge ?? '', notes: lab?.notes ?? '' });
  const [locs, setLocs] = useState<{ name: string; was?: string }[]>((lab?.locations ?? []).map((n) => ({ name: n, was: n })));
  const [copy, setCopy] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const base = { name: f.name, short: f.short, color: f.color, icon: f.icon, room: f.room || undefined, incharge: f.incharge || undefined, notes: f.notes || undefined, archived: lab?.archived };
    const names = [...new Set(locs.map((l) => l.name.trim()).filter(Boolean))];
    const id = attempt(() => saveLab({ ...base, id: lab?.id }, copy || undefined), 'Lab saved');
    if (!id) return;
    if (lab) {
      const renames: Record<string, string> = {};
      locs.forEach((l) => { if (l.was && l.name.trim() && l.was !== l.name.trim()) renames[l.was] = l.name.trim(); });
      tryDo(() => setLabLocations(id, names, renames));
    } else if (!copy && names.length) tryDo(() => setLabLocations(id, names));
    onClose();
  };
  const remove = async () => {
    if (!lab) return;
    if (await confirmDialog({ title: `Delete ${lab.name}?`, body: 'Only possible when the lab has no items or entries.', confirm: 'Delete lab', danger: true })) { if (tryDo(() => deleteLab(lab.id), 'Lab deleted')) onClose(); }
  };
  return (
    <Modal size="lg" title={lab ? `Edit ${lab.name}` : 'Add a lab'} onClose={onClose}
      footer={<>
        {lab && <><Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /></Button><Button className="mr-auto" onClick={() => { tryDo(() => saveLab({ ...lab, archived: !lab.archived }), lab.archived ? 'Lab restored' : 'Lab archived'); onClose(); }}><ArchiveRestore className="h-4 w-4" /> {lab.archived ? 'Restore' : 'Archive'}</Button></>}
        <Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" required className="sm:col-span-2"><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Computer Lab" /></Field>
        <Field label="Short code" required help="Used in item codes, e.g. PHY"><input className="input uppercase" maxLength={5} value={f.short} onChange={(e) => set('short', e.target.value.toUpperCase())} /></Field>
        <Field label="Room"><input className="input" value={f.room} onChange={(e) => set('room', e.target.value)} /></Field>
        <Field label="Teacher in charge" className="sm:col-span-2"><input className="input" value={f.incharge} onChange={(e) => set('incharge', e.target.value)} /></Field>
        <div className="sm:col-span-3">
          <span className="label">Colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {LAB_COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={f.color === c} onClick={() => set('color', c)} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: f.color === c ? 'var(--c-ink)' : 'transparent' }} />)}
            <input type="color" aria-label="Custom colour" value={f.color} onChange={(e) => set('color', e.target.value)} className="h-7 w-9 cursor-pointer rounded border bg-transparent" />
          </div>
        </div>
        <div className="sm:col-span-3"><span className="label">Icon</span><IconPicker value={f.icon} onChange={(v) => set('icon', v)} /></div>
        {!lab && <Field label="Copy the setup of another lab" className="sm:col-span-3" help="The new lab then offers the same item categories and forms, and starts with the same locations."><select className="input" value={copy} onChange={(e) => setCopy(e.target.value)}><option value="">Start blank</option>{activeLabs({ labs }).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
      </div>
      {(lab || !copy) && (
        <div className="mt-5">
          <span className="label">Places things are kept (cupboards, shelves, fridges)</span>
          <div className="space-y-1.5">
            {locs.map((l, n) => (
              <div key={n} className="flex gap-2"><input className="input" aria-label="Location" value={l.name} onChange={(e) => setLocs((x) => x.map((y, i) => (i === n ? { ...y, name: e.target.value } : y)))} /><button className="btn btn-ghost btn-icon" aria-label="Remove location" onClick={() => setLocs((x) => x.filter((_, i) => i !== n))}><Trash2 className="h-4 w-4" /></button></div>
            ))}
          </div>
          <Button className="mt-2" size="sm" onClick={() => setLocs((x) => [...x, { name: '' }])}><Plus className="h-3.5 w-3.5" /> Add a place</Button>
          <p className="help">Renaming a place also renames it on the items kept there. Removing one leaves those items as they are.</p>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------ Categories

function CategoriesTab() {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const labs = useStore((s) => s.labs);
  const [edit, setEdit] = useState<Category | 'new' | null>(null);
  return (
    <>
      <p className="mb-3 text-sm text-muted">A category decides what an item asks for. <b>Chemicals</b> have hazards, expiry and a CAS number; <b>instruments</b> have a service schedule and serial number. Add your own, with your own fields.</p>
      <div className="mb-3 flex justify-end"><Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> New category</Button></div>
      <Card pad={false} className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Category</th><th>Kind</th><th>Tracks</th><th>Labs</th><th className="text-right">Items</th><th className="text-right">Extra fields</th><th /></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setEdit(c)} style={c.archived ? { opacity: 0.55 } : undefined}>
                <td><span className="inline-flex items-center gap-2 font-medium"><Icon name={c.icon} className="h-4 w-4 text-accent" />{c.name}{c.archived && <Badge>archived</Badge>}</span></td>
                <td>{c.kind === 'asset' ? 'Equipment (lent & returned)' : 'Consumable (used up)'}</td>
                <td><span className="flex flex-wrap gap-1">{c.trackExpiry && <Badge tone="amber">expiry</Badge>}{c.hazardous && <Badge tone="red">hazards</Badge>}{c.trackService && <Badge tone="blue">service</Badge>}</span></td>
                <td className="text-muted">{c.labIds.length === 0 ? 'All labs' : c.labIds.map((id) => labs.find((l) => l.id === id)?.short).filter(Boolean).join(', ')}</td>
                <td className="text-right tabular-nums">{items.filter((i) => i.categoryId === c.id).length}</td>
                <td className="text-right tabular-nums">{c.fields.length}</td>
                <td className="text-right"><Pencil className="inline h-4 w-4 text-faint" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {edit && <CategoryDialog cat={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function CategoryDialog({ cat, onClose }: { cat?: Category; onClose: () => void }) {
  const labs = useStore((s) => s.labs).filter((l) => !l.archived);
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const [c, setC] = useState<Omit<Category, 'id'>>(() => cat ? { ...cat, fields: structuredClone(cat.fields) } : { name: '', icon: 'package', labIds: [], kind: 'consumable', codePrefix: '', defaultUnit: 'pcs', trackExpiry: false, hazardous: false, trackService: false, fields: [] });
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((x) => ({ ...x, [k]: v }));
  const used = cat ? items.filter((i) => i.categoryId === cat.id).length : 0;
  const save = () => {
    const prefix = c.codePrefix.trim().toUpperCase() || c.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'ITM';
    if (tryDo(() => { saveCategory({ ...c, codePrefix: prefix, id: cat?.id }); }, 'Category saved')) onClose();
  };
  const remove = async () => {
    if (!cat) return;
    if (await confirmDialog({ title: `Delete “${cat.name}”?`, body: used ? `${used} items use it, so it cannot be deleted. Archive it instead to hide it from new items.` : 'This cannot be undone.', confirm: used ? 'OK' : 'Delete category', danger: !used })) {
      if (used) tryDo(() => saveCategory({ ...cat, archived: !cat.archived }), cat.archived ? 'Restored' : 'Archived');
      else if (tryDo(() => deleteCategory(cat.id), 'Category deleted')) onClose();
    }
  };
  return (
    <Modal size="lg" title={cat ? `Edit ${cat.name}` : 'New item category'} onClose={onClose}
      footer={<>{cat && <Button variant="danger" className="mr-auto" onClick={remove}>{used ? (cat.archived ? 'Restore…' : 'Archive…') : <><Trash2 className="h-4 w-4" /> Delete</>}</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" required className="sm:col-span-2"><input className="input" autoFocus value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Lab coats" /></Field>
        <Field label="Code prefix" help="e.g. LBC → CHE-LBC-0001"><input className="input uppercase" maxLength={5} value={c.codePrefix} onChange={(e) => set('codePrefix', e.target.value.toUpperCase())} /></Field>
        <Field label="Behaves like" className="sm:col-span-2" help="Equipment can be lent out and returned. Consumables are used up and need restocking.">
          <select className="input" value={c.kind} onChange={(e) => set('kind', e.target.value as never)}><option value="consumable">Consumable (chemicals, paper, wires…)</option><option value="asset">Equipment (instruments, glassware, models…)</option></select>
        </Field>
        <Field label="Usual unit"><input className="input" list="units-dl" value={c.defaultUnit} onChange={(e) => set('defaultUnit', e.target.value)} /><datalist id="units-dl">{(lists.find((l) => l.id === 'units')?.options ?? []).map((u) => <option key={u} value={u} />)}</datalist></Field>
        <div className="sm:col-span-3"><span className="label">What should be tracked for these items?</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Checkbox checked={c.trackExpiry} onChange={(v) => set('trackExpiry', v)}>Expiry date and batch</Checkbox>
            <Checkbox checked={c.hazardous} onChange={(v) => set('hazardous', v)}>Hazard labels and storage group</Checkbox>
            <Checkbox checked={c.trackService} onChange={(v) => set('trackService', v)}>Calibration / service schedule</Checkbox>
          </div></div>
        <div className="sm:col-span-3"><span className="label">Used in</span><LabChecks value={c.labIds} onChange={(v) => set('labIds', v)} labs={labs} /></div>
        <div className="sm:col-span-3"><span className="label">Icon</span><IconPicker value={c.icon} onChange={(v) => set('icon', v)} /></div>
      </div>
      <h3 className="mt-6 mb-1 font-semibold">Fields specific to this category</h3>
      <p className="mb-2 text-sm text-muted">These appear on the item form and can be shown as columns in the inventory table.</p>
      <FieldsEditor fields={c.fields} onChange={(f) => set('fields', f)} lists={lists} />
    </Modal>
  );
}

// ------------------------------------------------------------ Forms & logs

function FormsTab() {
  const modules = useStore((s) => s.modules);
  const labs = useStore((s) => s.labs);
  const [edit, setEdit] = useState<ModuleDef | 'new' | null>(null);
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  return (
    <>
      <p className="mb-3 text-sm text-muted">Every log in the sidebar is a form you can change: rename it, switch it off, restrict it to some labs, or edit the questions it asks. Create your own logs for anything else you want to record: fridge temperatures, safety checks, visitors…</p>
      <div className="mb-3 flex justify-end"><Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> New custom log</Button></div>
      <Card pad={false} className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th className="w-20">Order</th><th>Log</th><th>What it does</th><th>Labs</th><th>On</th><th /></tr></thead>
          <tbody>
            {sorted.map((m, n) => (
              <tr key={m.id} className={cx('clickable')} onClick={() => setEdit(m)} style={!m.enabled ? { opacity: 0.55 } : undefined}>
                <td onClick={(e) => e.stopPropagation()}><span className="flex"><button className="btn btn-ghost btn-icon" aria-label="Move up" disabled={n === 0} onClick={() => moveModule(m.id, -1)}><ChevronUp className="h-4 w-4" /></button><button className="btn btn-ghost btn-icon" aria-label="Move down" disabled={n === sorted.length - 1} onClick={() => moveModule(m.id, 1)}><ChevronDown className="h-4 w-4" /></button></span></td>
                <td><span className="inline-flex items-center gap-2 font-medium"><Icon name={m.icon} className="h-4 w-4 text-accent" />{m.name}{!m.builtin && <Badge tone="violet">custom</Badge>}</span></td>
                <td className="max-w-md text-muted">{m.description}</td>
                <td className="text-muted">{m.labIds.length === 0 ? 'All labs' : m.labIds.map((id) => labs.find((l) => l.id === id)?.short).filter(Boolean).join(', ')}</td>
                <td onClick={(e) => e.stopPropagation()}><Checkbox checked={m.enabled} onChange={(v) => tryDo(() => saveModule({ ...m, enabled: v }))}><span className="sr-only">Enabled</span></Checkbox></td>
                <td className="text-right"><Pencil className="inline h-4 w-4 text-faint" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {edit && <ModuleDialog mod={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ModuleDialog({ mod, onClose }: { mod?: ModuleDef; onClose: () => void }) {
  const labs = useStore((s) => s.labs).filter((l) => !l.archived);
  const lists = useStore((s) => s.lists);
  const records = useStore((s) => s.records);
  const [m, setM] = useState<Omit<ModuleDef, 'id' | 'order'>>(() => mod ? { ...mod, fields: structuredClone(mod.fields), listFieldIds: [...mod.listFieldIds] } : {
    kind: 'custom', name: '', singular: '', icon: 'clipboard', builtin: false, enabled: true, labIds: [], description: '',
    fields: [{ id: 'date', label: 'Date', type: 'date', required: true, default: '@today' }, { id: 'note', label: 'Note', type: 'textarea', full: true }],
    dateFieldId: 'date', listFieldIds: ['date', 'note'],
  });
  const set = <K extends keyof typeof m>(k: K, v: (typeof m)[K]) => setM((x) => ({ ...x, [k]: v }));
  const count = mod ? records.filter((r) => r.moduleId === mod.id).length : 0;
  const dateFields = m.fields.filter((f) => f.type === 'date' || f.type === 'datetime');
  const selectFields = m.fields.filter((f) => f.type === 'select');
  const statusField = m.fields.find((f) => f.id === m.statusFieldId);
  const statusOptions = statusField ? (statusField.listId ? (lists.find((l) => l.id === statusField.listId)?.options ?? []) : (statusField.options ?? [])) : [];

  const save = () => {
    const singular = m.singular.trim() || m.name.trim().replace(/s$/i, '');
    if (tryDo(() => { saveModule({ ...m, singular, id: mod?.id, order: undefined }); }, 'Saved')) onClose();
  };
  const remove = async () => {
    if (!mod || mod.builtin) return;
    if (await confirmDialog({ title: `Delete the “${mod.name}” log?`, body: count ? `Its ${count} entries are deleted too. This cannot be undone (except right away with Undo).` : 'This cannot be undone.', confirm: 'Delete log', danger: true })) { if (tryDo(() => deleteModule(mod.id), 'Log deleted')) onClose(); }
  };

  return (
    <Modal size="lg" title={mod ? `Edit “${mod.name}”` : 'New custom log'} sub={mod?.builtin ? 'A built-in log: the questions can be changed and hidden, but not removed.' : undefined} onClose={onClose}
      footer={<>{mod && !mod.builtin && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name in the sidebar" required><input className="input" autoFocus value={m.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Fridge temperature" /></Field>
        <Field label="One entry is called" help="e.g. Reading"><input className="input" value={m.singular} onChange={(e) => set('singular', e.target.value)} /></Field>
        <Field label="Date of each entry is in"><select className="input" value={m.dateFieldId} onChange={(e) => set('dateFieldId', e.target.value)}>{dateFields.map((f) => <option key={f.id} value={f.id}>{f.label || 'Untitled field'}</option>)}</select></Field>
        <Field label="What it is for" className="sm:col-span-3"><input className="input" value={m.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="sm:col-span-3"><span className="label">Available in</span><LabChecks value={m.labIds} onChange={(v) => set('labIds', v)} labs={labs} /></div>
        <div className="sm:col-span-3"><span className="label">Icon</span><IconPicker value={m.icon} onChange={(v) => set('icon', v)} /></div>
        {!mod?.builtin && (
          <>
            <Field label="Progress / status field" help="Optional: lets entries be open or finished, with alerts for open ones">
              <select className="input" value={m.statusFieldId ?? ''} onChange={(e) => setM((x) => ({ ...x, statusFieldId: e.target.value || undefined, closedValues: [] }))}><option value="">None</option>{selectFields.map((f) => <option key={f.id} value={f.id}>{f.label || 'Untitled field'}</option>)}</select>
            </Field>
            {statusField && <div className="sm:col-span-2"><span className="label">These statuses mean “finished”</span><div className="flex flex-wrap gap-x-4 gap-y-1.5">{statusOptions.map((o) => <Checkbox key={o} checked={(m.closedValues ?? []).includes(o)} onChange={(v) => set('closedValues', v ? [...(m.closedValues ?? []), o] : (m.closedValues ?? []).filter((x) => x !== o))}>{o}</Checkbox>)}</div></div>}
          </>
        )}
      </div>
      <h3 className="mt-6 mb-1 font-semibold">Questions on the form</h3>
      <FieldsEditor fields={m.fields} onChange={(f) => set('fields', f)} lists={lists} columns={m.listFieldIds} onColumns={(ids) => set('listFieldIds', ids)} />
    </Modal>
  );
}

// ------------------------------------------------------------ Lists

const TONES: Tone[] = ['gray', 'blue', 'green', 'amber', 'red', 'violet', 'teal'];

function ListsTab() {
  const lists = useStore((s) => s.lists);
  const [edit, setEdit] = useState<ListDef | 'new' | null>(null);
  return (
    <>
      <p className="mb-3 text-sm text-muted">Lists are the drop-down choices used across the app: units, classes, accident types, hazards, statuses… Edit any of them, or make new lists for your own fields.</p>
      <div className="mb-3 flex justify-end"><Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> New list</Button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lists.map((l) => (
          <button key={l.id} onClick={() => setEdit(l)} className="card p-4 text-left hover:bg-surface2">
            <div className="flex items-center justify-between"><h3 className="font-semibold">{l.name}</h3>{!l.builtin && <Badge tone="violet">custom</Badge>}</div>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{l.options.join(' · ') || 'Empty'}</p>
            <p className="mt-1 text-xs text-faint">{l.options.length} choices</p>
          </button>
        ))}
      </div>
      {edit && <ListDialog list={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ListDialog({ list, onClose }: { list?: ListDef; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? '');
  const [desc, setDesc] = useState(list?.description ?? '');
  const [opts, setOpts] = useState<string[]>(list?.options ?? ['']);
  const [tones, setTones] = useState<Record<string, Tone>>(list?.tones ?? {});
  const setOpt = (n: number, v: string) => {
    const old = opts[n];
    setOpts((o) => o.map((x, i) => (i === n ? v : x)));
    if (tones[old] && old !== v) setTones((t) => { const { [old]: tone, ...rest } = t; return v ? { ...rest, [v]: tone } : rest; });
  };
  const paste = (n: number, text: string) => {
    const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    setOpts((o) => [...o.slice(0, n), ...lines, ...o.slice(n + 1)]);
    return true;
  };
  const save = () => {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    const t = Object.fromEntries(Object.entries(tones).filter(([k]) => clean.includes(k)));
    if (tryDo(() => { saveList({ id: list?.id, name, description: desc || undefined, options: clean, tones: t, builtin: list?.builtin }); }, 'List saved')) onClose();
  };
  const remove = async () => {
    if (list && await confirmDialog({ title: `Delete the “${list.name}” list?`, confirm: 'Delete list', danger: true })) { if (tryDo(() => deleteList(list.id), 'List deleted')) onClose(); }
  };
  return (
    <Modal size="md" title={list ? `Edit “${list.name}”` : 'New list'} onClose={onClose}
      footer={<>{list && !list.builtin && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-3">
        <Field label="Name" required><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div>
          <span className="label">Choices</span>
          <div className="space-y-1.5">
            {opts.map((o, n) => (
              <div key={n} className="flex items-center gap-2">
                <input className="input" aria-label={`Choice ${n + 1}`} value={o} onChange={(e) => setOpt(n, e.target.value)} onPaste={(e) => { if (paste(n, e.clipboardData.getData('text'))) e.preventDefault(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOpts((x) => [...x.slice(0, n + 1), '', ...x.slice(n + 1)]); setTimeout(() => (e.currentTarget.closest('div')?.nextElementSibling?.querySelector('input') as HTMLInputElement | null)?.focus(), 0); } }} />
                <select className="input w-28" aria-label="Colour" value={tones[o] ?? ''} onChange={(e) => setTones((t) => { const c = { ...t }; if (e.target.value) c[o] = e.target.value as Tone; else delete c[o]; return c; })}><option value="">No colour</option>{TONES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <button className="btn btn-ghost btn-icon" aria-label="Remove choice" onClick={() => setOpts((x) => x.filter((_, i) => i !== n))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <Button className="mt-2" size="sm" onClick={() => setOpts((o) => [...o, ''])}><Plus className="h-3.5 w-3.5" /> Add a choice</Button>
          <p className="help">Tip: paste several lines into a choice to add them all. Renaming a choice does not change entries that already use the old name.</p>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ Rules

function RulesTab() {
  const s = useStore((x) => x.settings);
  const groups = useStore((x) => x.lists.find((l) => l.id === 'storageGroups')?.options ?? []);
  const pairs = s.incompatible;
  const setPair = (n: number, i: 0 | 1, v: string) => updateSettings({ incompatible: pairs.map((p, k) => (k === n ? (i === 0 ? [v, p[1]] : [p[0], v]) : p)) as [string, string][] });
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-semibold">When to warn</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warn this many days before expiry"><input className="input" type="number" min="0" value={s.expiryWarnDays} onChange={(e) => updateSettings({ expiryWarnDays: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Warn about a fine still unpaid after this many days"><input className="input" type="number" min="1" value={s.fineUnpaidDays} onChange={(e) => updateSettings({ fineUnpaidDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <Field label="Warn this many days before a service is due"><input className="input" type="number" min="0" value={s.serviceWarnDays} onChange={(e) => updateSettings({ serviceWarnDays: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        </div>
        <p className="help mt-3">Low-stock warnings use each item's own “reorder level”. Overdue loans, open accidents and spills, and follow-ups that have passed are always flagged.</p>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Storage groups that must be kept apart</h2>
        <p className="mb-3 text-sm text-muted">If two items from a pair are kept in the same place, the Storage check raises an alert.</p>
        <div className="space-y-2">
          {pairs.map((p, n) => (
            <div key={n} className="flex items-center gap-2">
              <select className="input" aria-label="First group" value={p[0]} onChange={(e) => setPair(n, 0, e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
              <span className="text-muted">≠</span>
              <select className="input" aria-label="Second group" value={p[1]} onChange={(e) => setPair(n, 1, e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
              <button className="btn btn-ghost btn-icon" aria-label="Remove pair" onClick={() => updateSettings({ incompatible: pairs.filter((_, k) => k !== n) })}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {pairs.length === 0 && <EmptyState icon="shield" title="No pairs set">Add pairs to enable the storage check.</EmptyState>}
        </div>
        <Button className="mt-3" size="sm" onClick={() => updateSettings({ incompatible: [...pairs, [groups[0] ?? '', groups[1] ?? '']] })}><Plus className="h-3.5 w-3.5" /> Add a pair</Button>
      </Card>
    </div>
  );
}
