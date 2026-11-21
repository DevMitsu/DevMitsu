import { useMemo, useState } from 'react';
import { addDays, fmtDateTime, todayStr } from '../../domain/dates';
import { defaultValues, num, validate } from '../../domain/fields';
import { suggestedFine } from '../../domain/fines';
import { ALL, modulesForLab, outOnLoan } from '../../domain/inventory';
import type { Value, Values } from '../../domain/types';
import { Field, Button, Modal, Badge } from '../../components/ui';
import { FieldGrid } from '../../components/FieldInputs';
import { confirmDialog, attempt, notify } from '../../components/toast';
import { useScope } from '../../lib/scope';
import { closeUi } from '../../lib/ui';
import { deleteRecord, saveRecord } from '../../store/actions';
import { useStore } from '../../store/store';

interface Props {
  moduleId: string;
  id?: string;
  labId?: string;
  prefill?: Values;
}

const STOCK_KINDS = ['usage', 'spill', 'breakage', 'disposal', 'loan'];

export function RecordEditor({ moduleId, id, labId: initialLab, prefill }: Props) {
  const { scope, labs } = useScope();
  const modules = useStore((s) => s.modules);
  const records = useStore((s) => s.records);
  const items = useStore((s) => s.items);
  const loanDays = useStore((s) => s.settings.loanDefaultDays);
  const { currency, finePercent } = useStore((s) => s.settings);
  const mod = modules.find((m) => m.id === moduleId);
  const existing = id ? records.find((r) => r.id === id) : undefined;

  const allowedLabs = useMemo(
    () => labs.filter((l) => !mod || mod.labIds.length === 0 || mod.labIds.includes(l.id) || l.id === existing?.labId),
    [labs, mod, existing],
  );
  const [labId, setLabId] = useState(() => existing?.labId ?? initialLab ?? (scope !== ALL ? scope : allowedLabs[0]?.id) ?? '');
  const [values, setValues] = useState<Values>(() => {
    if (existing) return { ...existing.values };
    const v = { ...defaultValues(mod?.fields ?? []), ...prefill };
    if (mod?.kind === 'loan' && !v.due) v.due = addDays(todayStr(), loanDays);
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!mod) return null;
  const close = () => closeUi('record');

  const set = (fid: string, v: Value) => {
    setErrors((e) => ({ ...e, [fid]: '' }));
    setValues((cur) => {
      const next = { ...cur, [fid]: v };
      if (mod.kind === 'requisition' && fid === 'item' && v) {
        const it = items.find((i) => i.id === v);
        if (it) {
          if (!cur.name) next.name = it.name;
          if (!cur.unit) next.unit = it.unit;
          if (!cur.supplier && it.supplier) next.supplier = it.supplier;
        }
      }
      return next;
    });
  };

  const changeLab = (l: string) => {
    setLabId(l);
    // Items belong to one lab, so a different lab means choosing the item again
    setValues((cur) => {
      const next = { ...cur };
      for (const f of mod.fields) if (f.type === 'item' || f.type === 'items') delete next[f.id];
      return next;
    });
  };

  const item = items.find((i) => i.id === values.item);
  const out = outOnLoan(records);
  const qty = num(values.quantity);
  const myOut = existing && !existing.values.returned && mod.kind === 'loan' ? (num(existing.values.quantity) ?? 0) : 0;
  const available = item ? Math.round((item.quantity - (out.get(item.id) ?? 0) + myOut) * 1e6) / 1e6 : undefined;
  const myBack = existing && STOCK_KINDS.slice(0, 4).includes(mod.kind) && num(existing.values.quantity) && existing.values.item === item?.id ? (num(existing.values.quantity) ?? 0) : 0;
  const inStock = item ? item.quantity + myBack : undefined;
  const short =
    item && qty != null
      ? mod.kind === 'loan'
        ? !values.returned && qty > (available ?? 0)
        : STOCK_KINDS.slice(0, 4).includes(mod.kind) && qty > (inStock ?? 0) && !(mod.kind === 'spill' && values.deduct === false)
      : false;

  const save = (another: boolean) => {
    const errs = validate(mod.fields, values);
    if (!labId) errs.lab = 'Choose a lab';
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      notify('Please fill in the highlighted fields.', 'error');
      return;
    }
    setBusy(true);
    const ok = attempt(() => saveRecord(moduleId, labId, values, id), existing ? `${mod.singular} updated` : `${mod.singular} saved`);
    setBusy(false);
    if (ok === undefined) return;
    if (another) setValues({ ...defaultValues(mod.fields), ...(mod.kind === 'loan' ? { due: addDays(todayStr(), loanDays) } : {}) });
    else close();
  };

  const remove = async () => {
    const stockNote = STOCK_KINDS.slice(0, 4).includes(mod.kind) && values.item && qty ? ' The quantity will be put back into stock.' : '';
    if (await confirmDialog({ title: `Delete this ${mod.singular.toLowerCase()}?`, body: `This removes the entry from the log.${stockNote}`, confirm: 'Delete', danger: true })) {
      attempt(() => deleteRecord(id!), `${mod.singular} deleted`);
      close();
    }
  };

  const labIsFixed = !!existing || scope !== ALL || allowedLabs.length <= 1;

  return (
    <Modal
      size="md"
      title={existing ? `Edit ${mod.singular.toLowerCase()}` : `New ${mod.singular.toLowerCase()}`}
      sub={mod.description}
      onClose={close}
      footer={
        <>
          {existing && <Button variant="danger" className="mr-auto" onClick={remove}>Delete</Button>}
          <Button onClick={close}>Cancel</Button>
          {!existing && <Button disabled={busy} onClick={() => save(true)}>Save & add another</Button>}
          <Button variant="primary" disabled={busy} onClick={() => save(false)}>Save</Button>
        </>
      }
    >
      {!labIsFixed && (
        <Field label="Lab" required error={errors.lab} className="mb-3">
          <select className="input" value={labId} onChange={(e) => changeLab(e.target.value)}>
            {allowedLabs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      )}
      <FieldGrid fields={mod.fields} values={values} onChange={set} errors={errors} hideIds={mod.kind === 'breakage' && !num(values.fine) ? ['fineStatus', 'finePaidOn', 'fineNote'] : []} ctx={{ labId, units: item ? { quantity: item.unit } : undefined }} />
      {item && STOCK_KINDS.includes(mod.kind) && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${short ? 'tone-red' : 'bg-surface2 text-muted'}`}>
          {mod.kind === 'loan'
            ? `${available} of ${item.quantity} ${item.unit} available to lend.`
            : `${inStock} ${item.unit} in stock${item.location ? ` · kept in ${item.location}` : ''}.`}
          {short && ' That is more than is available.'}
          {mod.kind !== 'loan' && qty && !short && !(mod.kind === 'spill' && values.deduct === false) && mod.kind !== 'incident'
            ? ` After this: ${Math.round(((inStock ?? 0) - qty) * 1e6) / 1e6} ${item.unit}.`
            : ''}
        </p>
      )}
      {mod.kind === 'breakage' && item && !mod.fields.find((f) => f.id === 'fine')?.hidden && (() => {
        const sug = suggestedFine(item, qty ?? 0, finePercent);
        if (sug === undefined) return item.unitCost == null ? <p className="help mt-3">Add a cost to {item.name} and a suggested fine will be offered here.</p> : null;
        const same = num(values.fine) === sug;
        return (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm">
            <span className="text-muted">Suggested fine: <b className="text-ink">{currency}{sug}</b> ({finePercent}% of {currency}{item.unitCost} × {qty})</span>
            {!same && <Button size="sm" onClick={() => set('fine', sug)}>Use this</Button>}
            {num(values.fine) ? <Button size="sm" variant="ghost" onClick={() => set('fine', '')}>No fine</Button> : null}
          </p>
        );
      })()}
      {existing && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-faint">
          Entered {fmtDateTime(existing.createdAt)}{existing.by ? ` by ${existing.by}` : ''}
          {existing.updatedAt !== existing.createdAt && <Badge>edited {fmtDateTime(existing.updatedAt)}</Badge>}
        </p>
      )}
    </Modal>
  );
}

/** The list of forms the current lab has switched on, for "New…" menus. */
export function useModulesFor(scope: string) {
  const modules = useStore((s) => s.modules);
  return useMemo(() => modulesForLab({ modules }, scope), [modules, scope]);
}
