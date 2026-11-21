import { Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ItemPicker } from '../../components/FieldInputs';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Suggest } from '../../components/ui';
import { attempt, confirmDialog, tryDo } from '../../components/toast';
import { todayStr } from '../../domain/dates';
import { ALL, outOnLoan } from '../../domain/inventory';
import type { Item, Practical, PracticalMaterial } from '../../domain/types';
import { useScope } from '../../lib/scope';
import { deletePractical, runPractical, saveRecord, savePractical } from '../../store/actions';
import { useStore } from '../../store/store';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** For N groups: what each linked material needs, what is available, what is short. */
export function planPractical(p: Practical, groups: number, items: Item[], out: Map<string, number>) {
  return p.materials.map((m) => {
    const item = m.itemId ? items.find((i) => i.id === m.itemId) : undefined;
    const need = round(m.qtyPerGroup * groups);
    const have = item ? round(item.quantity - (out.get(item.id) ?? 0)) : undefined;
    return { m, item, need, have, short: item && have !== undefined ? Math.max(0, round(need - have)) : 0, perGroup: m.qtyPerGroup };
  });
}

export function PracticalsPage() {
  const { scope, lab } = useScope();
  const practicals = useStore((s) => s.practicals);
  const items = useStore((s) => s.items);
  const records = useStore((s) => s.records);
  const allLabs = useStore((s) => s.labs);
  const [edit, setEdit] = useState<Practical | 'new' | null>(null);
  const [plan, setPlan] = useState<Practical | null>(null);
  const out = useMemo(() => outOnLoan(records), [records]);
  const list = practicals.filter((p) => !p.archived && (scope === ALL || p.labId === scope));

  return (
    <div>
      <PageHeader icon="flask" title={`Practicals${lab ? ` · ${lab.name}` : ''}`} sub="Write down what each practical needs per group. Then check whether the lab has enough for a class, raise requirements for what is missing, and record all the usage in one click."
        actions={<Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> New practical</Button>} />
      {list.length === 0 ? (
        <Card><EmptyState icon="flask" title="No practicals yet" action={<Button variant="primary" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add a practical</Button>}>List the materials a practical needs per group of students. You will then see at a glance whether you can run it for a whole class.</EmptyState></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const rows = planPractical(p, 1, items, out).filter((r) => r.item && r.perGroup > 0);
            const maxGroups = rows.length ? Math.min(...rows.map((r) => Math.floor((r.have ?? 0) / r.perGroup))) : undefined;
            const l = scope === ALL ? undefined : lab;
            return (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-muted">{[p.level, p.durationMin ? `${p.durationMin} min` : '', scope === ALL ? (allLabs.find((x) => x.id === p.labId)?.name ?? '') : (l?.name ?? '')].filter(Boolean).join(' · ')}</p></div>
                  {maxGroups !== undefined && <Badge tone={maxGroups >= 8 ? 'green' : maxGroups >= 1 ? 'amber' : 'red'} title="How many groups the current stock can supply">{maxGroups} groups</Badge>}
                </div>
                <ul className="my-3 flex-1 space-y-1 text-sm text-muted">
                  {p.materials.slice(0, 5).map((m, n) => <li key={n}>{m.qtyPerGroup} {m.unit ?? items.find((i) => i.id === m.itemId)?.unit ?? ''} {m.name}</li>)}
                  {p.materials.length > 5 && <li>+ {p.materials.length - 5} more</li>}
                  {p.materials.length === 0 && <li>No materials listed yet</li>}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => setPlan(p)}><Play className="h-3.5 w-3.5" /> Plan / run</Button>
                  <Button size="sm" onClick={() => setEdit(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" onClick={() => attempt(() => savePractical({ ...p, id: undefined, name: `${p.name} (copy)` }), 'Practical duplicated')}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {edit && <PracticalEditor practical={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {plan && <PlanDialog practical={plan} onClose={() => setPlan(null)} />}
    </div>
  );
}

// ------------------------------------------------------------ plan / run

function PlanDialog({ practical, onClose }: { practical: Practical; onClose: () => void }) {
  const items = useStore((s) => s.items);
  const records = useStore((s) => s.records);
  const classes = useStore((s) => s.lists.find((l) => l.id === 'classes')?.options ?? []);
  const people = useStore((s) => s.people);
  const [groups, setGroups] = useState('8');
  const [date, setDate] = useState(todayStr());
  const [cls, setCls] = useState(practical.level ?? '');
  const [user, setUser] = useState('');
  const out = useMemo(() => outOnLoan(records), [records]);
  const g = Math.max(0, Number(groups) || 0);
  const rows = planPractical(practical, g, items, out);
  const short = rows.filter((r) => r.short > 0);
  const tracked = rows.filter((r) => r.item && r.perGroup > 0);
  
  const requestShortfall = () => {
    let n = 0;
    for (const r of short) {
      if (!r.item) continue;
      const ok = tryDo(() => { saveRecord('requisition', practical.labId, { requested: todayStr(), item: r.item!.id, name: r.item!.name, quantity: r.short, unit: r.item!.unit, priority: 'Normal', reason: `For practical: ${practical.name} (${g} groups)`, supplier: r.item!.supplier, status: 'Requested' }); });
      if (ok) n++;
    }
    if (n) attempt(() => undefined, `${n} requirement${n > 1 ? 's' : ''} raised`);
  };

  return (
    <Modal size="lg" title={`Plan: ${practical.name}`} sub="Set the number of groups to see whether the lab has enough." onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        {short.length > 0 && <Button onClick={requestShortfall}>Request the {short.length} missing item{short.length > 1 ? 's' : ''}</Button>}
        <Button variant="primary" disabled={g <= 0 || short.length > 0 || tracked.length === 0} title={short.length ? 'Not enough stock for this many groups' : undefined}
          onClick={() => { const n = attempt(() => runPractical(practical.id, g, { date, class: cls || undefined, user: user || undefined }), 'Usage recorded'); if (n !== undefined) onClose(); }}>Record usage for {g} groups</Button>
      </>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Field label="Groups"><input className="input" type="number" min="1" value={groups} onChange={(e) => setGroups(e.target.value)} autoFocus /></Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Class"><Suggest value={cls} onChange={setCls} options={classes} /></Field>
        <Field label="Teacher"><Suggest value={user} onChange={setUser} options={people.filter((p) => p.active).map((p) => p.name)} /></Field>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="tbl">
          <thead><tr><th>Material</th><th className="text-right">Per group</th><th className="text-right">Needed</th><th className="text-right">Available</th><th /></tr></thead>
          <tbody>
            {rows.map((r, n) => (
              <tr key={n}>
                <td>{r.m.name}{r.m.note && <span className="text-xs text-muted"> · {r.m.note}</span>}</td>
                <td className="text-right tabular-nums">{r.perGroup} {r.m.unit ?? r.item?.unit ?? ''}</td>
                <td className="text-right tabular-nums">{r.need} {r.m.unit ?? r.item?.unit ?? ''}</td>
                <td className="text-right tabular-nums">{r.item ? `${r.have} ${r.item.unit}` : '—'}</td>
                <td>{!r.item ? <Badge>not tracked</Badge> : r.short > 0 ? <Badge tone="red">short by {r.short}</Badge> : <Badge tone="green">enough</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {practical.safety && <p className="mt-3 rounded-lg tone-amber p-3 text-sm"><b>Safety:</b> {practical.safety}</p>}
      <p className="help mt-2">Recording usage adds one Usage-log entry per tracked material and takes the amounts off the stock. Equipment is checked for availability only: lend it from Issue &amp; return.</p>
    </Modal>
  );
}

// ------------------------------------------------------------ edit

function PracticalEditor({ practical, onClose }: { practical?: Practical; onClose: () => void }) {
  const { scope, labs } = useScope();
  const items = useStore((s) => s.items);
  const classes = useStore((s) => s.lists.find((l) => l.id === 'classes')?.options ?? []);
  const [labId, setLabId] = useState(practical?.labId ?? (scope !== ALL ? scope : labs[0]?.id) ?? '');
  const [name, setName] = useState(practical?.name ?? '');
  const [level, setLevel] = useState(practical?.level ?? '');
  const [mins, setMins] = useState(String(practical?.durationMin ?? ''));
  const [desc, setDesc] = useState(practical?.description ?? '');
  const [safety, setSafety] = useState(practical?.safety ?? '');
  const [mats, setMats] = useState<PracticalMaterial[]>(practical?.materials ?? []);
  const labItems = items.filter((i) => i.labId === labId && !i.archived);

  const setMat = (n: number, patch: Partial<PracticalMaterial>) => setMats((m) => m.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const save = () => {
    const clean = mats.filter((m) => m.name.trim() || m.itemId).map((m) => ({ ...m, name: m.name.trim() || items.find((i) => i.id === m.itemId)?.name || 'Material', qtyPerGroup: Number(m.qtyPerGroup) || 0 }));
    if (tryDo(() => { savePractical({ id: practical?.id, labId, name, level: level || undefined, durationMin: Number(mins) || undefined, description: desc || undefined, safety: safety || undefined, materials: clean }); }, 'Practical saved')) onClose();
  };
  const remove = async () => {
    if (practical && await confirmDialog({ title: `Delete “${practical.name}”?`, confirm: 'Delete', danger: true })) { tryDo(() => deletePractical(practical.id), 'Practical deleted'); onClose(); }
  };

  return (
    <Modal size="lg" title={practical ? 'Edit practical' : 'New practical'} onClose={onClose}
      footer={<>{practical && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Name" required className="sm:col-span-2"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acid–base titration" /></Field>
        <Field label="Class"><Suggest value={level} onChange={setLevel} options={classes} /></Field>
        <Field label="Minutes"><input className="input" type="number" min="0" value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
        {scope === ALL && !practical && labs.length > 1 && (
          <Field label="Lab" className="sm:col-span-2"><select className="input" value={labId} onChange={(e) => { setLabId(e.target.value); setMats((m) => m.map((x) => ({ ...x, itemId: undefined }))); }}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        )}
        <Field label="Safety notes" className="sm:col-span-4"><input className="input" value={safety} onChange={(e) => setSafety(e.target.value)} placeholder="Shown when planning the practical" /></Field>
        <Field label="Description / procedure" className="sm:col-span-4"><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      </div>
      <h3 className="mt-5 mb-2 text-sm font-semibold">Materials per group</h3>
      <div className="space-y-2">
        {mats.map((m, n) => (
          <div key={n} className="grid grid-cols-[1fr_5.5rem_auto] items-start gap-2 sm:grid-cols-[1.4fr_1fr_5.5rem_4.5rem_auto]">
            <div className="col-span-3 sm:col-span-1"><ItemPicker items={labItems} value={m.itemId} onChange={(id) => { const it = items.find((i) => i.id === id); setMat(n, { itemId: id || undefined, name: it?.name ?? m.name, unit: it?.unit ?? m.unit }); }} placeholder="Pick from inventory…" /></div>
            <input className="input" aria-label="Material name" placeholder="or type a name" value={m.name} onChange={(e) => setMat(n, { name: e.target.value })} />
            <input className="input" aria-label="Quantity per group" type="number" min="0" step="any" value={m.qtyPerGroup || ''} onChange={(e) => setMat(n, { qtyPerGroup: Number(e.target.value) })} placeholder="Qty" />
            <input className="input" aria-label="Unit" value={m.unit ?? ''} onChange={(e) => setMat(n, { unit: e.target.value })} placeholder="Unit" />
            <button className="btn btn-ghost btn-icon" aria-label="Remove material" onClick={() => setMats((x) => x.filter((_, i) => i !== n))}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={() => setMats((m) => [...m, { name: '', qtyPerGroup: 1 }])}><Plus className="h-4 w-4" /> Add material</Button>
      <p className="help mt-2">Link a material to an inventory item to check availability and record usage. Type a name instead for things you do not track (water, paper…).</p>
    </Modal>
  );
}
