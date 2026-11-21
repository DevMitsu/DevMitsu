import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Checkbox, Field, cx } from '../../components/ui';
import { uid } from '../../domain/ids';
import type { FieldDef, FieldType, ListDef } from '../../domain/types';

export const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short text', textarea: 'Long text', number: 'Number', money: 'Money', date: 'Date', datetime: 'Date and time',
  select: 'Drop-down (choose one)', multiselect: 'Multiple choice', checkbox: 'Yes / no tick box', url: 'Web link',
  item: 'An inventory item', items: 'Several inventory items', person: 'A person (name)', supplier: 'A supplier (name)',
};

interface Props {
  fields: FieldDef[];
  onChange: (f: FieldDef[]) => void;
  lists: ListDef[];
  /** In forms: which fields are columns in the list. */
  columns?: string[];
  onColumns?: (ids: string[]) => void;
}

export function FieldsEditor({ fields, onChange, lists, columns, onColumns }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const patch = (id: string, p: Partial<FieldDef>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const move = (n: number, d: -1 | 1) => {
    const j = n + d;
    if (j < 0 || j >= fields.length) return;
    const a = [...fields];
    [a[n], a[j]] = [a[j], a[n]];
    onChange(a);
  };
  const add = () => {
    const f: FieldDef = { id: uid('f'), label: '', type: 'text' };
    onChange([...fields, f]);
    // A new question is also a new column in the list, so it is visible straight away
    if (columns && onColumns) onColumns([...columns, f.id]);
    setOpen(f.id);
  };

  return (
    <div>
      <ul className="divide-y rounded-xl border">
        {fields.length === 0 && <li className="p-4 text-center text-sm text-muted">No fields yet.</li>}
        {fields.map((f, n) => {
          const isOpen = open === f.id;
          return (
            <li key={f.id} className={cx(f.hidden && 'opacity-60')}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.id)}>
                  <span className="truncate font-medium">{f.label || <span className="text-faint italic">Untitled field</span>}</span>
                  <Badge>{TYPE_LABEL[f.type]}</Badge>
                  {f.required && <Badge tone="amber">required</Badge>}
                  {f.core && <span title="The app relies on this field, so it cannot be removed or hidden" className="text-faint"><Lock className="h-3.5 w-3.5" /></span>}
                  {f.hidden && <Badge>hidden</Badge>}
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Move up" disabled={n === 0} onClick={() => move(n, -1)}><ChevronUp className="h-4 w-4" /></button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Move down" disabled={n === fields.length - 1} onClick={() => move(n, 1)}><ChevronDown className="h-4 w-4" /></button>
                {f.builtin ? (
                  !f.core && <button type="button" className="btn btn-ghost btn-icon" aria-label={f.hidden ? 'Show field' : 'Hide field'} title={f.hidden ? 'Show this field' : 'Hide this field'} onClick={() => patch(f.id, { hidden: !f.hidden })}>{f.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label="Delete field" onClick={() => { onChange(fields.filter((x) => x.id !== f.id)); onColumns?.((columns ?? []).filter((c) => c !== f.id)); }}><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              {isOpen && (
                <div className="grid gap-3 border-t bg-surface2 px-3 py-3 sm:grid-cols-2">
                  <Field label="Label" required><input className="input" autoFocus value={f.label} onChange={(e) => patch(f.id, { label: e.target.value })} /></Field>
                  <Field label="Type" help={f.builtin ? 'Built-in fields keep their type' : undefined}>
                    <select className="input" disabled={f.builtin} value={f.type} onChange={(e) => patch(f.id, { type: e.target.value as FieldType, listId: undefined, options: undefined })}>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  {(f.type === 'select' || f.type === 'multiselect') && (
                    <>
                      <Field label="Choices come from">
                        <select className="input" value={f.listId ?? ''} onChange={(e) => patch(f.id, e.target.value ? { listId: e.target.value, options: undefined } : { listId: undefined, options: f.options ?? [] })}>
                          <option value="">This field's own choices</option>
                          {lists.map((l) => <option key={l.id} value={l.id}>Shared list: {l.name}</option>)}
                        </select>
                      </Field>
                      {!f.listId && <Field label="Choices" help="One per line"><textarea className="input min-h-24" value={(f.options ?? []).join('\n')} onChange={(e) => patch(f.id, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></Field>}
                    </>
                  )}
                  {f.type === 'number' && <Field label="Unit shown after the number"><input className="input" value={f.unit ?? ''} onChange={(e) => patch(f.id, { unit: e.target.value || undefined })} placeholder="e.g. °C, mL, mm" /></Field>}
                  {!['checkbox', 'select', 'multiselect', 'item', 'items'].includes(f.type) && <Field label="Hint inside the box"><input className="input" value={f.placeholder ?? ''} onChange={(e) => patch(f.id, { placeholder: e.target.value || undefined })} /></Field>}
                  <Field label="Help text under the field"><input className="input" value={f.help ?? ''} onChange={(e) => patch(f.id, { help: e.target.value || undefined })} /></Field>
                  {(f.type === 'date' || f.type === 'datetime') && (
                    <Field label="Starts as"><select className="input" value={f.default === '@today' || f.default === '@now' ? String(f.default) : ''} onChange={(e) => patch(f.id, { default: e.target.value || undefined })}><option value="">Empty</option>{f.type === 'date' ? <option value="@today">Today</option> : <option value="@now">Now</option>}</select></Field>
                  )}
                  {f.type === 'checkbox' && <div className="flex items-end pb-2"><Checkbox checked={f.default === true} onChange={(v) => patch(f.id, { default: v || undefined })}>Ticked to start with</Checkbox></div>}
                  <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-1 sm:col-span-2">
                    {f.type !== 'checkbox' && <Checkbox disabled={f.core} checked={!!f.required} onChange={(v) => patch(f.id, { required: v })}>Must be filled in</Checkbox>}
                    <Checkbox checked={!!f.full} onChange={(v) => patch(f.id, { full: v })}>Use the full width</Checkbox>
                    {columns && onColumns && <Checkbox checked={columns.includes(f.id)} onChange={(v) => onColumns(v ? [...columns, f.id] : columns.filter((c) => c !== f.id))}>Show as a column in the list</Checkbox>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button className="mt-3" onClick={add}><Plus className="h-4 w-4" /> Add a field</Button>
    </div>
  );
}
