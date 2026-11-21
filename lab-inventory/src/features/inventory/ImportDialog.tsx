import { Download, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Field, Modal } from '../../components/ui';
import { attempt } from '../../components/toast';
import { parseTable, toCSV, download } from '../../domain/csv';
import { mapTable, templateRows } from '../../domain/importer';
import { categoriesForLab } from '../../domain/inventory';
import { closeUi } from '../../lib/ui';
import { importItems } from '../../store/actions';
import { useStore } from '../../store/store';

export function ImportDialog({ labId }: { labId: string }) {
  const state = useStore((s) => s);
  const lab = state.labs.find((l) => l.id === labId);
  const cats = categoriesForLab(state, labId);
  const [text, setText] = useState('');
  const [cat, setCat] = useState(cats[0]?.id ?? '');
  const file = useRef<HTMLInputElement>(null);
  const close = () => closeUi('importLab');

  const result = useMemo(() => (text.trim() ? mapTable(state, labId, parseTable(text), cat) : null), [state, labId, text, cat]);
  const catName = (id: string) => state.categories.find((c) => c.id === id)?.name ?? '';

  const onFile = async (f?: File) => {
    if (!f) return;
    setText(await f.text());
  };
  const template = () => {
    const c = state.categories.find((x) => x.id === cat) ?? cats[0];
    if (!c) return;
    const [head, ex] = templateRows(state, labId, c);
    download(`${lab?.short ?? 'lab'}-${c.id}-template.csv`, toCSV(head, [ex]));
  };

  return (
    <Modal
      size="lg"
      title={`Import items into ${lab?.name ?? 'the lab'}`}
      sub="Copy rows from Excel or Google Sheets and paste them below, or choose a CSV file. The first row must be the column headings."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!result?.items.length} onClick={() => attempt(() => importItems(result!.items), `Imported ${result!.items.length} items`) !== undefined && close()}>
            Import {result?.items.length ? `${result.items.length} items` : ''}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Category when the sheet has none" className="min-w-56">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Button onClick={template}><Download className="h-4 w-4" /> Download a template for this category</Button>
        <Button onClick={() => file.current?.click()}><Upload className="h-4 w-4" /> Choose a file</Button>
        <input ref={file} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <textarea className="input min-h-32 font-mono text-xs" placeholder={'Name\tCategory\tQuantity\tUnit\tLocation\nBeaker 250 mL\tGlassware & plasticware\t30\tpcs\tGlassware cupboard'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Pasted rows" />
      <p className="help">Recognised headings: Name, Category, Code, Quantity, Unit, Location, Supplier, Cost, Min stock, Fill up to, Status, Expiry, Lot, Hazards, Storage group, Purchase date, Notes, Tags, and any of your category field names (e.g. CAS number).</p>

      {result && (
        <div className="mt-4 space-y-3">
          {result.problems.length > 0 && (
            <div className="rounded-lg tone-amber p-3 text-sm">
              <b>Please check:</b>
              <ul className="mt-1 list-disc pl-5">{result.problems.slice(0, 8).map((p, n) => <li key={n}>{p}</li>)}</ul>
              {result.problems.length > 8 && <p className="mt-1">…and {result.problems.length - 8} more.</p>}
            </div>
          )}
          {result.unknownHeaders.length > 0 && <p className="text-sm text-muted">Ignored columns: {result.unknownHeaders.join(', ')}</p>}
          {result.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Location</th><th>Expiry</th></tr></thead>
                <tbody>
                  {result.items.slice(0, 8).map((i, n) => (
                    <tr key={n}><td>{i.name}</td><td><Badge>{catName(i.categoryId)}</Badge></td><td>{i.quantity} {i.unit}</td><td>{i.location ?? '—'}</td><td>{i.expiry ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
              {result.items.length > 8 && <p className="px-3 py-2 text-xs text-muted">…and {result.items.length - 8} more rows</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
