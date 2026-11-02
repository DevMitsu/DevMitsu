import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { AccessionPicker } from '../../components/ui/AccessionPicker';
import { Button } from '../../components/ui/Button';
import { ErrorList, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { NoteField, OTHER, emptyNote, noteText, type NoteValue } from '../../components/ui/NoteField';
import { SuggestField, type Suggestion } from '../../components/ui/SuggestField';
import { Select } from '../../components/ui/Select';
import { notify } from '../../components/ui/toast';
import { Badge } from '../../components/ui/Badge';
import { bookById, nextAccession } from '../../domain/queries';
import { LIBRARIES, norm, otherLibrary } from '../../domain/rules';
import type { Book, Collection, LibraryId } from '../../domain/types';
import { cleanIsbn, isValidIsbn } from '../../domain/isbn';
import { accessionClash, addBook, exportBooks, importBooks, removeBooks, transferBooks } from '../../store/actions';
import { useStore } from '../../store/store';

/** Where a book came from. Choosing a "received from outside" source files it under Imports in Reports. */
function SourceField({ value, onChange }: { value: NoteValue; onChange: (v: NoteValue) => void }) {
  const notes = useStore((s) => s.settings.notes);
  return (
    <div>
      <label htmlFor="book-source" className="mb-1.5 block text-[13px] font-medium text-ink">Where did it come from? <span className="text-muted">(required)</span></label>
      <div className="relative">
        <select id="book-source" value={value.choice} onChange={(e) => onChange({ ...value, choice: e.target.value })} className="h-10 w-full appearance-none rounded-control border border-line bg-panel pr-9 pl-3 text-sm text-ink hover:border-primary/40">
          <option value="">Choose…</option>
          <optgroup label="New to the library">{notes.newBook.map((o) => <option key={`n-${o}`} value={o}>{o}</option>)}</optgroup>
          <optgroup label="Received from outside (counts as an import)">{notes.import.map((o) => <option key={`i-${o}`} value={o}>{o}</option>)}</optgroup>
          <option value={OTHER}>Other (type below)</option>
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {value.choice === OTHER && <input type="text" value={value.other} onChange={(e) => onChange({ ...value, other: e.target.value })} aria-label="Source, typed" placeholder="Type where it came from" className="mt-2 h-10 w-full rounded-control border border-line bg-panel px-3 text-sm placeholder:text-muted" />}
    </div>
  );
}

export function AddBookDialog({ library, onClose }: { library: LibraryId; onClose: () => void }) {
  const state = useStore((s) => s);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState('');
  const [lib, setLib] = useState<LibraryId>(library);
  const [collection, setCollection] = useState<Collection>('general');
  const [acc, setAcc] = useState('');
  const [accEdited, setAccEdited] = useState(false);
  const [source, setSource] = useState(emptyNote());
  const [errors, setErrors] = useState<string[]>([]);

  // Everything already in the catalogue, plus what was typed before.
  const titleOptions = useMemo<Suggestion[]>(() => {
    const seen = new Map<string, Suggestion & { book?: Book; author?: string; type?: string }>();
    state.books.forEach((b) => { if (!seen.has(norm(b.title))) seen.set(norm(b.title), { value: b.title, hint: [b.author, b.type].filter(Boolean).join(' · '), book: b }); });
    state.memory.titles.forEach((t) => { if (!seen.has(norm(t.title))) seen.set(norm(t.title), { value: t.title, hint: [t.author, t.type].filter(Boolean).join(' · '), author: t.author, type: t.type }); });
    return [...seen.values()];
  }, [state.books, state.memory.titles]);
  const authorOptions = useMemo<Suggestion[]>(() => [...new Set([...state.books.map((b) => b.author), ...state.memory.authors].filter((a): a is string => !!a))].map((value) => ({ value })), [state.books, state.memory.authors]);
  const publisherOptions = useMemo<Suggestion[]>(() => [...new Set([...state.books.map((b) => b.publisher), ...state.memory.publishers].filter((a): a is string => !!a))].map((value) => ({ value })), [state.books, state.memory.publishers]);
  const typeOptions = useMemo<Suggestion[]>(() => [...new Set([...state.books.map((b) => b.type), ...state.memory.types, 'DF'])].sort().map((value) => ({ value, hint: value === 'DF' ? 'Daily Five' : undefined })), [state.books, state.memory.types]);
  const copies = title.trim() ? state.books.filter((b) => norm(b.title) === norm(title)) : [];

  // A known ISBN fills in the rest, so another copy takes seconds.
  const isbnClean = cleanIsbn(isbn);
  const isbnOk = !isbnClean || isValidIsbn(isbnClean);
  const known = isbnClean && isValidIsbn(isbnClean) ? state.books.find((b) => b.isbn === isbnClean) : undefined;
  const fillFrom = (b: Book) => { setTitle(b.title); setSubtitle(b.subtitle ?? ''); setAuthor(b.author ?? ''); setPublisher(b.publisher ?? ''); setYear(b.year ? String(b.year) : ''); setType(b.type); };
  useEffect(() => { if (known && !title.trim()) fillFrom(known); }, [known?.id]); // eslint-disable-line

  useEffect(() => { if (!accEdited) setAcc(String(nextAccession(state, lib, collection))); }, [lib, collection, accEdited, state]);
  const clash = acc && Number(acc) > 0 ? accessionClash(state.books, Number(acc), type || 'FICTION') : undefined;
  const yearBad = year !== '' && !(Number(year) >= 1400 && Number(year) <= new Date().getFullYear() + 1);

  const save = () => {
    const note = noteText(source);
    const kind = state.settings.notes.import.includes(note) ? 'import' : 'new';
    const res = addBook({ title, subtitle, author, publisher, year: year ? Number(year) : undefined, isbn, type: type || 'FICTION', library: lib, collection, accession: Number(acc), note, kind });
    if (!res.ok) return setErrors(res.errors);
    notify(res);
    onClose();
  };
  return (
    <Modal open onClose={onClose} size="lg" title="Add a book" description="Scan or type the ISBN first. If this book is already in the catalogue, the rest is filled in. Titles, authors, publishers and genres you have used before are suggested as you type."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!!clash || !isbnOk || yearBad}>Add book</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <ErrorList errors={errors} />
        <TextField label="ISBN (optional)" value={isbn} onChange={setIsbn} autoFocus inputMode="numeric" placeholder="10 or 13 digits, from the back cover"
          error={!isbnOk ? 'That is not a valid ISBN. Check the number.' : undefined}
          hint={known ? <>Already in the catalogue: <span className="font-medium text-ink">{known.title}</span>. This adds another copy.</> : isbnClean && isbnOk ? 'Valid ISBN.' : 'Older books may not have one. You can leave it blank.'} />
        <SuggestField label="Title" value={title} onChange={setTitle} suggestions={titleOptions}
          onPick={(s) => { const t = s as Suggestion & { book?: Book; author?: string; type?: string }; if (t.book) fillFrom(t.book); else { if (t.author) setAuthor(t.author); if (t.type) setType(t.type); } }}
          hint={copies.length ? `Already in the catalogue: ${copies.length} cop${copies.length === 1 ? 'y' : 'ies'} (${copies.slice(0, 4).map((c) => `#${c.accession}`).join(', ')}). This adds another copy.` : undefined} />
        <TextField label="Subtitle (optional)" value={subtitle} onChange={setSubtitle} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SuggestField label="Author (optional)" value={author} onChange={setAuthor} suggestions={authorOptions} />
          <SuggestField label="Genre / book type" value={type} onChange={setType} suggestions={typeOptions} placeholder="e.g. FICTION" hint="Type DF for Daily Five. New genres are remembered." />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <SuggestField label="Publisher (optional)" value={publisher} onChange={setPublisher} suggestions={publisherOptions} />
          <TextField label="Year published" type="number" inputMode="numeric" value={year} onChange={setYear} placeholder="e.g. 2019" error={yearBad ? 'Enter a year such as 2019' : undefined} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Library" value={lib} onChange={(e) => { setLib(e.target.value as LibraryId); setAccEdited(false); }}>{(['jr', 'sr'] as LibraryId[]).map((l) => <option key={l} value={l}>{LIBRARIES[l].label}</option>)}</Select>
          <Select label="Collection" value={collection} onChange={(e) => { setCollection(e.target.value as Collection); setAccEdited(false); }}><option value="general">General</option><option value="cambridge">Cambridge (teachers only)</option></Select>
          <TextField label="Accession no." type="number" inputMode="numeric" value={acc} onChange={(v) => { setAcc(v); setAccEdited(true); }} error={clash ? `Already used by “${clash.title}”` : undefined} />
        </div>
        <SourceField value={source} onChange={setSource} />
      </form>
    </Modal>
  );
}

const FIELDS = ['Accession no.', 'Title', 'Subtitle', 'Author', 'Genre', 'Publisher', 'Year', 'ISBN'] as const;
/** Paste rows copied from Excel. Columns, in order: accession no., title, subtitle, author, genre, publisher, year, ISBN. */
export function AddManyBooksDialog({ library, onClose }: { library: LibraryId; onClose: () => void }) {
  const state = useStore((s) => s);
  const [text, setText] = useState('');
  const [lib, setLib] = useState<LibraryId>(library);
  const [collection, setCollection] = useState<Collection>('general');
  const [source, setSource] = useState(emptyNote());
  const [result, setResult] = useState<string[]>([]);

  const rows = useMemo(() => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(','));
    const body = lines.length && !/^\s*\d/.test(split(lines[0]!)[0] ?? '') ? lines.slice(1) : lines;   // a header row starts with words, not a number
    return body.map((l) => {
      const c = split(l).map((x) => x.trim().replace(/^"|"$/g, ''));
      return { accession: Number(c[0]), title: c[1] ?? '', subtitle: c[2], author: c[3], type: c[4], publisher: c[5], year: c[6] ? Number(c[6]) : undefined, isbn: c[7] };
    });
  }, [text]);

  const run = () => {
    const res = importBooks({ rows, library: lib, collection, note: noteText(source) });
    setResult(res.errors);
    if (res.ok) notify(res);
    if (res.ok && !res.errors.length) onClose();
  };
  return (
    <Modal open onClose={onClose} size="xl" title="Add many books" description="Copy the rows from Excel and paste them here. One book per row; the first row can be a heading."
      footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={run} disabled={!rows.length || !noteText(source)}>Add {rows.length || ''} book{rows.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-4">
        <div className="rounded-control border border-line bg-canvas p-3 text-[13px]">
          <p className="font-medium text-ink">Columns, in this order</p>
          <p className="mt-1 text-muted">{FIELDS.join('  ·  ')}</p>
          <p className="mt-1 text-xs text-muted">Only accession number and title are needed. Leave a cell empty if you don’t have it. Columns from Excel are separated by tabs automatically.</p>
        </div>
        {result.length > 0 && <ErrorList errors={[`${result.length} row${result.length > 1 ? 's were' : ' was'} skipped:`, ...result.slice(0, 8), ...(result.length > 8 ? [`…and ${result.length - 8} more.`] : [])]} />}
        <label className="block text-[13px] font-medium">Rows from Excel
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult([]); }} rows={8} placeholder={'30001\tThe Hobbit\t\tJ. R. R. Tolkien\tFICTION\tHarperCollins\t1998\t9780261102217'} className="mt-1.5 w-full rounded-control border border-line bg-panel px-3 py-2 font-mono text-xs font-normal" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Library" value={lib} onChange={(e) => setLib(e.target.value as LibraryId)}>{(['jr', 'sr'] as LibraryId[]).map((l) => <option key={l} value={l}>{LIBRARIES[l].label}</option>)}</Select>
          <Select label="Collection" value={collection} onChange={(e) => setCollection(e.target.value as Collection)}><option value="general">General</option><option value="cambridge">Cambridge (teachers only)</option></Select>
          <div className="sm:col-span-1"><p className="mb-1.5 text-[13px] font-medium">Rows found</p><p className="flex h-10 items-center rounded-control border border-line bg-canvas px-3 text-sm tabular-nums">{rows.length}{state.books.length ? '' : ' (the library is empty)'}</p></div>
        </div>
        <SourceField value={source} onChange={setSource} />
      </div>
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
