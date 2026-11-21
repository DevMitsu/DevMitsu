import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../domain/dates';
import { isEmpty, num, optionsFor, toneFor } from '../domain/fields';
import type { FieldDef, Item, Value, Values } from '../domain/types';
import { scopePath } from '../lib/scope';
import { useStore } from '../store/store';
import { Badge, Checkbox, Field, Suggest, cx } from './ui';

export interface FieldCtx {
  labId: string;
  /** Unit suffix to show on number fields, keyed by field id (e.g. the chosen item's unit). */
  units?: Record<string, string>;
}

// ---------------------------------------------------------------- item picker

export function ItemPicker({
  items, value, onChange, placeholder = 'Search by name or code…', invalid,
}: { items: Item[]; value?: string; onChange: (id: string) => void; placeholder?: string; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.id === value);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => `${i.name} ${i.code} ${i.location ?? ''} ${i.tags?.join(' ') ?? ''}`.toLowerCase().includes(t)) : items;
    return list.slice(0, 40);
  }, [items, q]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={box} className="relative">
      <input
        className="input pr-8"
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid}
        placeholder={placeholder}
        value={open ? q : selected ? `${selected.name} (${selected.code})` : ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && open && matches[hi]) { e.preventDefault(); pick(matches[hi].id); }
          else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQ(''); }
        }}
      />
      {value && !open && (
        <button type="button" aria-label="Clear" className="absolute top-1/2 right-2 -translate-y-1/2 text-faint hover:text-ink" onClick={() => onChange('')}>
          <X className="h-4 w-4" />
        </button>
      )}
      {open && (
        <ul role="listbox" className="card absolute z-40 mt-1 max-h-64 w-full overflow-y-auto py-1 shadow-xl">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching items{items.length === 0 ? ' in this lab yet' : ''}.</li>}
          {matches.map((i, n) => (
            <li
              key={i.id}
              role="option"
              aria-selected={n === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(i.id); }}
              onMouseEnter={() => setHi(n)}
              className={cx('cursor-pointer px-3 py-1.5 text-sm', n === hi && 'bg-accent-soft')}
            >
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-muted">{i.code} · {i.quantity} {i.unit}{i.location ? ` · ${i.location}` : ''}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the input for one field

export function FieldInput({ def, value, onChange, ctx, error }: { def: FieldDef; value: Value; onChange: (v: Value) => void; ctx: FieldCtx; error?: string }) {
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const people = useStore((s) => s.people);
  const suppliers = useStore((s) => s.suppliers);
  const cats = useStore((s) => s.categories);
  const invalid = !!error;
  const common = { 'aria-invalid': invalid || undefined } as const;

  const labItems = useMemo(
    () => items.filter((i) => !i.archived && (!ctx.labId || i.labId === ctx.labId)),
    [items, ctx.labId],
  );
  const eligible = useMemo(() => {
    if (!def.itemKind) return labItems;
    const kind = new Map(cats.map((c) => [c.id, c.kind]));
    return labItems.filter((i) => kind.get(i.categoryId) === def.itemKind);
  }, [labItems, def.itemKind, cats]);

  const str = value == null ? '' : String(value);
  switch (def.type) {
    case 'textarea':
      return <textarea {...common} className="input" value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'money': {
      const unit = ctx.units?.[def.id] ?? def.unit;
      return (
        <div className="relative">
          <input {...common} className={cx('input', unit && 'pr-14')} style={def.type === 'money' ? { paddingLeft: '1.75rem' } : undefined} type="number" inputMode="decimal" step="any" min="0" value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
          {def.type === 'money' && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint"><Cur /></span>}
          {unit && <span className="pointer-events-none absolute top-1/2 right-3 max-w-12 -translate-y-1/2 truncate text-xs text-faint">{unit}</span>}
        </div>
      );
    }
    case 'date':
      return <input {...common} className="input" type="date" value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input {...common} className="input" type="datetime-local" value={str.slice(0, 16)} onChange={(e) => onChange(e.target.value)} />;
    case 'url':
      return <input {...common} className="input" type="url" value={str} placeholder={def.placeholder ?? 'https://'} onChange={(e) => onChange(e.target.value)} />;
    case 'checkbox':
      return <Checkbox checked={!!value} onChange={onChange}>{def.label}</Checkbox>;
    case 'select': {
      const opts = optionsFor({ lists }, def);
      return (
        <select {...common} className="input" value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          {str && !opts.includes(str) && <option value={str}>{str}</option>}
        </select>
      );
    }
    case 'multiselect': {
      const opts = optionsFor({ lists }, def);
      const cur = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {[...opts, ...cur.filter((c) => !opts.includes(c))].map((o) => {
            const on = cur.includes(o);
            return (
              <button type="button" key={o} aria-pressed={on} onClick={() => onChange(on ? cur.filter((x) => x !== o) : [...cur, o])}
                className={cx('rounded-full border px-2.5 py-1 text-xs font-medium', on ? 'border-accent bg-accent-soft text-accent' : 'text-muted hover:bg-surface2')}>
                {o}
              </button>
            );
          })}
          {opts.length === 0 && <span className="text-xs text-faint">No options yet</span>}
        </div>
      );
    }
    case 'item':
      return <ItemPicker items={eligible} value={str} onChange={onChange} invalid={invalid} />;
    case 'items': {
      const cur = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          {cur.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cur.map((id) => (
                <span key={id} className="badge tone-gray gap-1">
                  {items.find((i) => i.id === id)?.name ?? '(removed)'}
                  <button type="button" aria-label="Remove" onClick={() => onChange(cur.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <ItemPicker items={labItems.filter((i) => !cur.includes(i.id))} value="" onChange={(id) => id && onChange([...cur, id])} placeholder="Add an item…" />
        </div>
      );
    }
    case 'person':
      return <Suggest {...common} value={str} onChange={onChange} placeholder={def.placeholder ?? 'Type or choose a name'} options={people.filter((p) => p.active).map((p) => p.name)} />;
    case 'supplier':
      return <Suggest {...common} value={str} onChange={onChange} placeholder={def.placeholder ?? 'Type or choose a supplier'} options={suppliers.map((p) => p.name)} />;
    default:
      return <input {...common} className="input" value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function Cur() {
  const c = useStore((s) => s.settings.currency);
  return <>{c}</>;
}

// ---------------------------------------------------------------- a whole form

const wide = (f: FieldDef) => f.full || f.type === 'textarea' || f.type === 'items' || f.type === 'multiselect';

export function FieldGrid({
  fields, values, onChange, ctx, errors = {}, hideIds = [],
}: { fields: FieldDef[]; values: Values; onChange: (id: string, v: Value) => void; ctx: FieldCtx; errors?: Record<string, string>; hideIds?: string[] }) {
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {fields.filter((f) => !f.hidden && !hideIds.includes(f.id)).map((f) => (
        <div key={f.id} className={cx(wide(f) && 'sm:col-span-2', f.type === 'checkbox' && 'flex flex-col justify-end pb-1.5')}>
          {f.type === 'checkbox' ? (
            <>
              <FieldInput def={f} value={values[f.id]} onChange={(v) => onChange(f.id, v)} ctx={ctx} />
              {f.help && <span className="help block">{f.help}</span>}
            </>
          ) : (
            <Field label={f.label} required={f.required} help={f.help} error={errors[f.id]}>
              <FieldInput def={f} value={values[f.id]} onChange={(v) => onChange(f.id, v)} ctx={ctx} error={errors[f.id]} />
            </Field>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- showing a value

export function FieldValue({ def, value, scope, compact }: { def: FieldDef; value: Value; scope: string; compact?: boolean }) {
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const currency = useStore((s) => s.settings.currency);
  if (isEmpty(value) && def.type !== 'checkbox') return <span className="text-faint">—</span>;
  switch (def.type) {
    case 'date':
      return <span className="whitespace-nowrap">{fmtDate(String(value))}</span>;
    case 'datetime':
      return <span className="whitespace-nowrap">{fmtDateTime(String(value))}</span>;
    case 'checkbox':
      return value ? <Badge tone="green">Yes</Badge> : <span className="text-faint">No</span>;
    case 'select': {
      const t = toneFor({ lists }, def, String(value));
      return t ? <Badge tone={t}>{String(value)}</Badge> : <span>{String(value)}</span>;
    }
    case 'multiselect':
      return <span className="flex flex-wrap gap-1">{(value as string[]).map((v) => <Badge key={v} tone={toneFor({ lists }, def, v) ?? 'gray'}>{v}</Badge>)}</span>;
    case 'item': {
      const it = items.find((i) => i.id === value);
      return it ? <Link className="font-medium hover:underline" to={scopePath(scope, `items/${it.id}`)} onClick={(e) => e.stopPropagation()}>{it.name}</Link> : <span className="text-faint">(removed item)</span>;
    }
    case 'items': {
      const list = (value as string[]).map((id) => items.find((i) => i.id === id)).filter(Boolean) as Item[];
      const shown = compact ? list.slice(0, 2) : list;
      return <span>{shown.map((i, n) => <span key={i.id}>{n > 0 && ', '}<Link className="hover:underline" to={scopePath(scope, `items/${i.id}`)} onClick={(e) => e.stopPropagation()}>{i.name}</Link></span>)}{compact && list.length > 2 && ` +${list.length - 2}`}</span>;
    }
    case 'url':
      return <a href={String(value)} target="_blank" rel="noreferrer noopener" className="text-accent underline" onClick={(e) => e.stopPropagation()}>Open link</a>;
    case 'number':
      return <span className="tabular-nums">{String(value)}{def.unit ? ` ${def.unit}` : ''}</span>;
    case 'money':
      return <span className="tabular-nums">{currency}{num(value)?.toLocaleString('en-IN') ?? String(value)}</span>;
    case 'textarea':
      return <span className={cx(compact && 'line-clamp-2', 'whitespace-pre-wrap')}>{String(value)}</span>;
    default:
      return <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>;
  }
}

export function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</legend>
      {hint && <p className="help -mt-1 mb-2">{hint}</p>}
      {children}
    </fieldset>
  );
}
