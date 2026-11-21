import { useMemo, useState } from 'react';
import { FieldGrid, Section } from '../../components/FieldInputs';
import { Button, Field, Modal, Suggest } from '../../components/ui';
import { attempt, notify, tryDo } from '../../components/toast';
import { validate } from '../../domain/fields';
import { ALL, categoriesForLab, nextCode } from '../../domain/inventory';
import type { Value, Values } from '../../domain/types';
import { useScope } from '../../lib/scope';
import { closeUi } from '../../lib/ui';
import { addItem, updateItem } from '../../store/actions';
import { useStore } from '../../store/store';

interface Props { id?: string; labId?: string; categoryId?: string; duplicate?: boolean }

const text = (v: unknown) => (v == null ? '' : String(v));
const numOrUndef = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

export function ItemDialog({ id, labId: initialLab, categoryId: initialCat, duplicate }: Props) {
  const { scope, labs } = useScope();
  const state = useStore((s) => s);
  const existing = id && !duplicate ? state.items.find((i) => i.id === id) : undefined;
  const source = id ? state.items.find((i) => i.id === id) : undefined;

  const [labId, setLabId] = useState(() => source?.labId ?? initialLab ?? (scope !== ALL ? scope : labs[0]?.id) ?? '');
  const cats = useMemo(() => categoriesForLab(state, labId), [state, labId]);
  const [categoryId, setCategoryId] = useState(() => source?.categoryId ?? initialCat ?? cats[0]?.id ?? '');
  const cat = state.categories.find((c) => c.id === categoryId);
  const lab = state.labs.find((l) => l.id === labId);

  const [f, setF] = useState(() => ({
    name: duplicate && source ? `${source.name} (copy)` : (source?.name ?? ''),
    code: existing?.code ?? '',
    description: text(source?.description),
    quantity: existing ? String(existing.quantity) : '',
    unit: source?.unit ?? cat?.defaultUnit ?? 'pcs',
    minStock: text(source?.minStock),
    targetStock: text(source?.targetStock),
    location: text(source?.location),
    supplier: text(source?.supplier),
    unitCost: text(source?.unitCost),
    purchaseDate: text(source?.purchaseDate),
    status: source?.status ?? 'Good',
    lot: duplicate ? '' : text(source?.lot),
    expiry: duplicate ? '' : text(source?.expiry),
    hazards: source?.hazards ?? ([] as string[]),
    storageGroup: text(source?.storageGroup),
    serviceEveryDays: text(source?.serviceEveryDays),
    lastServiced: duplicate ? '' : text(source?.lastServiced),
    nextServiceDue: duplicate ? '' : text(source?.nextServiceDue),
    tags: (source?.tags ?? []).join(', '),
    notes: text(source?.notes),
  }));
  const [custom, setCustom] = useState<Values>(() => ({ ...(source?.custom ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  const lists = state.lists;
  const opt = (id: string) => lists.find((l) => l.id === id)?.options ?? [];
  const close = () => closeUi('item');

  const changeCategory = (cid: string) => {
    const next = state.categories.find((c) => c.id === cid);
    if (next && (!f.unit || f.unit === cat?.defaultUnit)) set('unit', next.defaultUnit);
    setCategoryId(cid);
  };
  const changeLab = (lid: string) => {
    setLabId(lid);
    const ok = categoriesForLab(state, lid);
    if (!ok.some((c) => c.id === categoryId)) setCategoryId(ok[0]?.id ?? '');
    set('location', '');
  };

  const save = (another: boolean) => {
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Required';
    if (!categoryId) errs.category = 'Choose a category';
    if (!f.unit.trim()) errs.unit = 'Required';
    for (const k of ['quantity', 'minStock', 'targetStock', 'unitCost', 'serviceEveryDays'] as const) {
      const v = f[k].trim();
      if (v && (!Number.isFinite(Number(v)) || Number(v) < 0)) errs[k] = 'Enter a number';
    }
    Object.assign(errs, Object.fromEntries(Object.entries(validate(cat?.fields ?? [], custom)).map(([k, v]) => [`c_${k}`, v])));
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      notify('Please fix the highlighted fields.', 'error');
      return;
    }
    const customClean: Values = {};
    for (const fd of cat?.fields ?? []) {
      const v = custom[fd.id];
      if (v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) customClean[fd.id] = fd.type === 'number' || fd.type === 'money' ? Number(v) : v;
    }
    const data = {
      labId, categoryId, name: f.name.trim(), description: f.description.trim() || undefined, unit: f.unit.trim(),
      minStock: numOrUndef(f.minStock), targetStock: numOrUndef(f.targetStock), location: f.location.trim() || undefined,
      supplier: f.supplier.trim() || undefined, unitCost: numOrUndef(f.unitCost), purchaseDate: f.purchaseDate || undefined,
      status: f.status || 'Good', lot: cat?.trackExpiry ? f.lot.trim() || undefined : undefined, expiry: cat?.trackExpiry ? f.expiry || undefined : undefined,
      hazards: cat?.hazardous && f.hazards.length ? f.hazards : undefined, storageGroup: cat?.hazardous ? f.storageGroup || undefined : undefined,
      serviceEveryDays: cat?.trackService ? numOrUndef(f.serviceEveryDays) : undefined,
      lastServiced: cat?.trackService ? f.lastServiced || undefined : undefined,
      nextServiceDue: cat?.trackService ? f.nextServiceDue || undefined : undefined,
      custom: customClean, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), notes: f.notes.trim() || undefined,
    };
    if (data.tags.length === 0) (data as { tags?: string[] }).tags = undefined;
    const code = f.code.trim() || undefined;

    if (existing) {
      if (tryDo(() => updateItem(existing.id, { ...data, code: code ?? existing.code }), 'Item updated')) close();
      return;
    }
    const newId = attempt(() => addItem({ ...data, code, quantity: numOrUndef(f.quantity) ?? 0 }), `Added ${data.name}`);
    if (newId === undefined) return;
    if (another) {
      setF((x) => ({ ...x, name: '', code: '', quantity: '', lot: '', expiry: '' }));
      setCustom({});
    } else close();
  };

  const labLocations = lab?.locations ?? [];
  const catFields = (cat?.fields ?? []).map((fd) => ({ ...fd, required: fd.required }));
  const setCustomField = (fid: string, v: Value) => { setCustom((c) => ({ ...c, [fid]: v })); setErrors((e) => ({ ...e, [`c_${fid}`]: '' })); };
  const customErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith('c_')).map(([k, v]) => [k.slice(2), v]));
  const preview = existing ? existing.code : nextCode(state, labId, categoryId);

  return (
    <Modal
      size="lg"
      title={existing ? `Edit ${existing.name}` : duplicate ? 'Duplicate item' : 'Add an item'}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          {!existing && <Button onClick={() => save(true)}>Save & add another</Button>}
          <Button variant="primary" onClick={() => save(false)}>{existing ? 'Save changes' : 'Add item'}</Button>
        </>
      }
    >
      <Section title="Basics">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {!existing && scope === ALL && labs.length > 1 && (
            <Field label="Lab" required>
              <select className="input" value={labId} onChange={(e) => changeLab(e.target.value)}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </Field>
          )}
          <Field label="Name" required error={errors.name} className="sm:col-span-2">
            <input className="input" autoFocus value={f.name} aria-invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sodium hydroxide pellets" />
          </Field>
          <Field label="Category" required error={errors.category}>
            <select className="input" value={categoryId} onChange={(e) => changeCategory(e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Code" help={existing ? 'Change only if you re-label the item' : 'Leave blank to number it automatically'}>
            <input className="input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder={preview} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional: size, grade, anything that helps identify it" />
          </Field>
        </div>
      </Section>

      <Section title="Stock">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-4">
          <Field label={existing ? 'In stock now' : 'Quantity in stock'} error={errors.quantity} help={existing ? 'Use Receive / Adjust on the item page' : undefined}>
            <input className="input" type="number" min="0" step="any" disabled={!!existing} value={existing ? String(existing.quantity) : f.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Field label="Unit" required error={errors.unit}>
            <Suggest value={f.unit} onChange={(v) => set('unit', v)} options={opt('units')} />
          </Field>
          <Field label="Reorder level" error={errors.minStock} help="Alert at or below this">
            <input className="input" type="number" min="0" step="any" value={f.minStock} onChange={(e) => set('minStock', e.target.value)} />
          </Field>
          <Field label="Fill up to" error={errors.targetStock} help="Used to suggest order size">
            <input className="input" type="number" min="0" step="any" value={f.targetStock} onChange={(e) => set('targetStock', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Where it is and what it cost">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Location" help={labLocations.length ? 'Pick one or type a new place: it is remembered' : 'Type a place: it is remembered'}>
            <Suggest value={f.location} onChange={(v) => set('location', v)} options={labLocations} />
          </Field>
          <Field label="Status">
            <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
              {opt('itemStatus').map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Supplier"><Suggest value={f.supplier} onChange={(v) => set('supplier', v)} options={state.suppliers.map((s) => s.name)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Cost per ${f.unit || 'unit'}`} error={errors.unitCost}>
              <input className="input" type="number" min="0" step="any" value={f.unitCost} onChange={(e) => set('unitCost', e.target.value)} />
            </Field>
            <Field label="Purchased on"><input className="input" type="date" value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></Field>
          </div>
        </div>
      </Section>

      {cat?.hazardous && (
        <Section title="Safety" hint="Hazard labels show on the item and in the chemical register. The storage group drives the storage check.">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Hazard labels" className="sm:col-span-2">
              <FieldGrid fields={[{ id: 'h', label: '', type: 'multiselect', listId: 'hazards' }]} values={{ h: f.hazards }} onChange={(_, v) => set('hazards', (v as string[]) ?? [])} ctx={{ labId }} />
            </Field>
            <Field label="Storage group">
              <select className="input" value={f.storageGroup} onChange={(e) => set('storageGroup', e.target.value)}>
                <option value="">—</option>
                {opt('storageGroups').map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
        </Section>
      )}

      {cat?.trackExpiry && (
        <Section title="Expiry">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Expiry date"><input className="input" type="date" value={f.expiry} onChange={(e) => set('expiry', e.target.value)} /></Field>
            <Field label="Lot / batch number"><input className="input" value={f.lot} onChange={(e) => set('lot', e.target.value)} /></Field>
          </div>
        </Section>
      )}

      {cat?.trackService && (
        <Section title="Calibration & servicing" hint="Log each service under Maintenance: the next due date is then worked out from the interval.">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Service every (days)" error={errors.serviceEveryDays}><input className="input" type="number" min="0" value={f.serviceEveryDays} onChange={(e) => set('serviceEveryDays', e.target.value)} placeholder="e.g. 365" /></Field>
            <Field label="Last serviced"><input className="input" type="date" value={f.lastServiced} onChange={(e) => set('lastServiced', e.target.value)} /></Field>
            <Field label="Next due"><input className="input" type="date" value={f.nextServiceDue} onChange={(e) => set('nextServiceDue', e.target.value)} /></Field>
          </div>
        </Section>
      )}

      {catFields.length > 0 && (
        <Section title={`${cat?.name} details`}>
          <FieldGrid fields={catFields} values={custom} onChange={setCustomField} ctx={{ labId }} errors={customErrors} />
        </Section>
      )}

      <Section title="Notes">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Tags" help="Comma separated; searchable"><input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. class 11, titration" /></Field>
          <Field label="Notes" className="sm:col-span-2"><textarea className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </Section>
    </Modal>
  );
}
