import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AccessionPicker } from '../../components/ui/AccessionPicker';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { NoteField, emptyNote, noteText } from '../../components/ui/NoteField';
import { Select } from '../../components/ui/Select';
import { notify } from '../../components/ui/toast';
import { Badge } from '../../components/ui/Badge';
import { bookById, nextAccession } from '../../domain/queries';
import { LIBRARIES, otherLibrary } from '../../domain/rules';
import type { Book, Collection, LibraryId } from '../../domain/types';
import { addBook, exportBooks, removeBooks, transferBooks } from '../../store/actions';
import { useStore } from '../../store/store';

export function AddBookDialog({ mode, library, onClose }: { mode: 'new' | 'import'; library: LibraryId; onClose: () => void }) {
  const state = useStore((s) => s);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [type, setType] = useState('FICTION');
  const [lib, setLib] = useState<LibraryId>(library);
  const [collection, setCollection] = useState<Collection>('general');
  const [acc, setAcc] = useState('');
  const [accEdited, setAccEdited] = useState(false);
  const [note, setNote] = useState(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);
  const types = useMemo(() => [...new Set(state.books.map((b) => b.type))].sort(), [state.books]);

  useEffect(() => { if (!accEdited) setAcc(String(nextAccession(state, lib, collection))); }, [lib, collection, accEdited, state]);
  const clash = acc ? state.books.find((b) => String(b.accession) === acc.trim()) : undefined;

  const save = () => {
    const res = addBook({ title, author, type, library: lib, collection, accession: Number(acc), note: noteText(note), kind: mode });
    if (!res.ok) return setErrors(res.errors);
    notify(res);
    onClose();
  };
  return (
    <Modal open onClose={onClose} size="lg" title={mode === 'import' ? 'Import a book' : 'Add a new book'}
      description={mode === 'import' ? 'A book coming into the library from outside, such as a donation.' : 'The next free accession number is filled in. You can change it.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!!clash}>{mode === 'import' ? 'Import book' : 'Add book'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <ErrorList errors={errors} />
        <TextField label="Title" value={title} onChange={setTitle} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Author (optional)" value={author} onChange={setAuthor} />
          <div>
            <TextField label="Book type" value={type} onChange={setType} list="book-types" />
            <datalist id="book-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Library" value={lib} onChange={(e) => { setLib(e.target.value as LibraryId); setAccEdited(false); }}>{(['jr', 'sr'] as LibraryId[]).map((l) => <option key={l} value={l}>{LIBRARIES[l].label}</option>)}</Select>
          <Select label="Collection" value={collection} onChange={(e) => { setCollection(e.target.value as Collection); setAccEdited(false); }}><option value="general">General</option><option value="cambridge">Cambridge (teachers only)</option></Select>
          <TextField label="Accession no." type="number" inputMode="numeric" value={acc} onChange={(v) => { setAcc(v); setAccEdited(true); }} error={clash ? `Already used by “${clash.title}”` : undefined} />
        </div>
        <NoteField category={mode === 'import' ? 'import' : 'newBook'} required label={mode === 'import' ? 'Source' : 'Note'} value={note} onChange={setNote} />
      </form>
    </Modal>
  );
}

const COPY = {
  transfer: { title: 'Transfer books', desc: 'Move books from one library to the other. They keep their accession numbers.', cat: 'transfer' as const, cta: 'Transfer' },
  export: { title: 'Export books', desc: 'Books leaving the school, such as returned to a supplier or donated out.', cat: 'export' as const, cta: 'Export' },
  remove: { title: 'Remove books', desc: 'Take books out of the collection because they are lost, damaged or discarded.', cat: 'removal' as const, cta: 'Remove' },
};

export function BookActionDialog({ kind, library, preselect, onClose }: { kind: 'transfer' | 'export' | 'remove'; library: LibraryId; preselect: string[]; onClose: () => void }) {
  const state = useStore((s) => s);
  const [from, setFrom] = useState<LibraryId>((bookById(state, preselect[0] ?? '')?.library) ?? library);
  const [ids, setIds] = useState<string[]>(preselect);
  const [status, setStatus] = useState<'Lost' | 'Damaged' | 'Discarded'>('Lost');
  const [note, setNote] = useState(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);
  const c = COPY[kind];
  const to = otherLibrary(from);

  const pool = useMemo(() => state.books.filter((b) => (kind === 'transfer' ? b.library === from : true) && b.status !== 'Out of school'), [state.books, kind, from]);
  const block = (b: Book) => (b.status === 'Issued' ? 'Currently issued: not available' : b.status !== 'Available' ? `Marked ${b.status.toLowerCase()}` : null);
  const chosen = ids.map((id) => bookById(state, id)).filter((b): b is Book => !!b);

  const run = () => {
    const n = noteText(note);
    const res = kind === 'transfer' ? transferBooks({ bookIds: ids, to, note: n }) : kind === 'export' ? exportBooks({ bookIds: ids, note: n }) : removeBooks({ bookIds: ids, status, note: n });
    if (!res.ok) return setErrors(res.errors);
    notify(res);
    onClose();
  };
  return (
    <Modal open onClose={onClose} size="lg" title={c.title} description={c.desc}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={run} disabled={!ids.length}>{c.cta} {ids.length || ''} book{ids.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-4">
        <ErrorList errors={errors} />
        {kind === 'transfer' && (
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <Select label="From" value={from} onChange={(e) => { setFrom(e.target.value as LibraryId); setIds([]); }}>{(['jr', 'sr'] as LibraryId[]).map((l) => <option key={l} value={l}>{LIBRARIES[l].label}</option>)}</Select>
            <span className="pb-2.5 text-muted" aria-hidden>→</span>
            <div><p className="mb-1.5 text-[13px] font-medium">To</p><p className="flex h-10 items-center rounded-control border border-line bg-canvas px-3 text-sm">{LIBRARIES[to].label}</p></div>
          </div>
        )}
        {kind === 'remove' && <Select label="Mark as" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>{['Lost', 'Damaged', 'Discarded'].map((s) => <option key={s}>{s}</option>)}</Select>}
        <AccessionPicker label={`${kind}-book`} pool={pool} selected={ids} onAdd={(b) => setIds((x) => [...x, b.id])} blockReason={block} />
        {chosen.length > 0 && (
          <ul className="divide-y divide-line rounded-control border border-line">
            {chosen.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 text-sm font-medium tabular-nums">#{b.accession}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{b.title}</span><span className="text-xs text-muted">{LIBRARIES[b.library].label} · {b.status}</span></span>
                {b.status === 'Issued' && <Badge tone="amber">Issued</Badge>}
                <button type="button" aria-label={`Remove ${b.title} from the list`} onClick={() => setIds((x) => x.filter((i) => i !== b.id))} className="grid size-8 place-items-center rounded-control text-muted hover:bg-sage-soft"><Trash2 className="size-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        <NoteField category={c.cat} required value={note} onChange={setNote} />
      </div>
    </Modal>
  );
}
