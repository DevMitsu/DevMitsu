import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, PackageMinus, PackageOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { LIBRARIES, norm } from '../../domain/rules';
import type { LibraryId } from '../../domain/types';
import { cn } from '../../lib/cn';
import { useStore } from '../../store/store';
import { AddBookDialog, BookActionDialog } from './CollectionDialogs';

const PAGE = 50;
type Dlg = null | { t: 'new' } | { t: 'transfer' | 'export' | 'remove' };

export function CollectionsPage() {
  const [sp] = useSearchParams();
  const active = useStore((s) => s.activeLibrary);
  const books = useStore((s) => s.books);
  const [lib, setLib] = useState<LibraryId>((sp.get('lib') as LibraryId) || active);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [coll, setColl] = useState('all');
  const [sort, setSort] = useState<'accession' | 'title' | 'author' | 'type'>('accession');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [dlg, setDlg] = useState<Dlg>(null);

  const inLib = useMemo(() => books.filter((b) => b.library === lib), [books, lib]);
  const types = useMemo(() => [...new Set(inLib.map((b) => b.type))].sort(), [inLib]);
  const rows = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean);
    return inLib
      .filter((b) => (status === 'all' || b.status === status) && (type === 'all' || b.type === type) && (coll === 'all' || b.collection === coll)
        && (!words.length || (/^\d+$/.test(q.trim()) ? String(b.accession).startsWith(q.trim()) : words.every((w) => norm(`${b.title} ${b.author ?? ''}`).includes(w)))))
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title) || a.accession - b.accession;
        if (sort === 'type') return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
        if (sort === 'author') return !a.author ? 1 : !b.author ? -1 : a.author.localeCompare(b.author) || a.title.localeCompare(b.title);
        return a.accession - b.accession || a.title.localeCompare(b.title);
      });
  }, [inLib, q, status, type, coll, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const counts = useMemo(() => ({ total: inLib.length, available: inLib.filter((b) => b.status === 'Available').length, issued: inLib.filter((b) => b.status === 'Issued').length }), [inLib]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const dupAcc = useMemo(() => { const c = new Map<string, number>(); books.forEach((b) => { const k = `${b.accession}|${b.type.toUpperCase() === 'DF'}`; c.set(k, (c.get(k) ?? 0) + 1); }); return c; }, [books]);

  return (
    <div>
      <PageHeader title="Collections" description="Every book, by library. Select rows, then transfer, export or remove them."
        actions={<>
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDlg({ t: 'new' })}>Add book</Button>
        </>} />
      <Tabs<LibraryId> label="Library" value={lib} onChange={(l) => { setLib(l); setPage(0); setSel([]); }} tabs={(['jr', 'sr'] as LibraryId[]).map((l) => ({ value: l, label: LIBRARIES[l].label, count: books.filter((b) => b.library === l).length }))} />
      <p className="mt-3 text-sm text-muted">{counts.total} books · {counts.available} available · {counts.issued} issued · {counts.total - counts.available - counts.issued} other</p>

      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="block text-[13px] font-medium">Search
          <span className="relative mt-1.5 block"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Title, author or accession no." className="block h-10 w-72 rounded-control border border-line bg-panel pr-3 pl-9 text-sm font-normal hover:border-primary/40" /></span>
        </label>
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-36"><option value="all">All</option>{['Available', 'Issued', 'Lost', 'Damaged', 'Discarded', 'Out of school'].map((s) => <option key={s}>{s}</option>)}</Select>
        <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} className="w-44"><option value="all">All</option>{types.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select label="Arrange by" value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(0); }} className="w-40"><option value="accession">Accession no.</option><option value="title">Title</option><option value="author">Author</option><option value="type">Genre / type</option></Select>
        <Select label="Collection" value={coll} onChange={(e) => { setColl(e.target.value); setPage(0); }} className="w-44"><option value="all">All</option><option value="general">General</option><option value="cambridge">Cambridge (teachers)</option></Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="text-sm text-muted">{sel.length ? `${sel.length} selected` : `${rows.length} books`}</span>
        <Button size="sm" icon={<ArrowRightLeft className="size-3.5" aria-hidden />} onClick={() => setDlg({ t: 'transfer' })}>Transfer{sel.length ? ' selected' : ''}</Button>
        <Button size="sm" icon={<PackageOpen className="size-3.5" aria-hidden />} onClick={() => setDlg({ t: 'export' })}>Export{sel.length ? ' selected' : ''}</Button>
        <Button size="sm" icon={<PackageMinus className="size-3.5" aria-hidden />} onClick={() => setDlg({ t: 'remove' })}>Remove{sel.length ? ' selected' : ''}</Button>
        {sel.length > 0 && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setSel([])}>Clear selection</Button>}
      </div>

      <Panel>
        {shown.length === 0 ? <p className="px-5 py-14 text-center text-sm text-muted">No book matches these filters.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase"><th className="w-10 px-4 py-2.5"><span className="sr-only">Select</span></th><th className="px-3 py-2.5 font-medium">Acc. no.</th><th className="px-3 py-2.5 font-medium">Title</th><th className="px-3 py-2.5 font-medium">Author</th><th className="px-3 py-2.5 font-medium">Genre / type</th><th className="px-3 py-2.5 font-medium">Status</th></tr></thead>
            <tbody>{shown.map((b, i) => (
              <Fragment key={b.id}>
              {sort === 'author' && (i === 0 || (shown[i - 1]!.author ?? '') !== (b.author ?? '')) && (
                <tr className="border-b border-line bg-canvas"><th colSpan={6} scope="colgroup" className="px-4 py-1.5 text-left text-xs font-semibold text-ink">{b.author ?? 'Author not recorded'}<span className="ml-2 font-normal text-muted">{rows.filter((r) => (r.author ?? '') === (b.author ?? '')).length} books</span></th></tr>
              )}
              <tr className={cn('border-b border-line last:border-b-0', sel.includes(b.id) && 'bg-sage-soft')}>
                <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${b.title}`} checked={sel.includes(b.id)} onChange={() => toggle(b.id)} className="size-4 accent-[var(--color-primary)]" /></td>
                <td className="px-3 py-2 font-medium tabular-nums">{b.accession}{(dupAcc.get(`${b.accession}|${b.type.toUpperCase() === 'DF'}`) ?? 0) > 1 && <span title="This number is shared with another book"> <Badge tone="amber">shared</Badge></span>}</td>
                <td className="px-3 py-2 font-medium text-ink">{b.title}</td>
                <td className="px-3 py-2 text-muted">{b.author ?? '—'}</td>
                <td className="px-3 py-2"><span className="flex flex-wrap gap-1"><span className="text-muted">{b.type}</span>{b.collection === 'cambridge' && <Badge tone="navy">Cambridge</Badge>}{b.type.toUpperCase() === 'DF' && <Badge tone="navy">Daily Five</Badge>}{b.transferredFrom && <Badge>from {LIBRARIES[b.transferredFrom].short}</Badge>}</span></td>
                <td className="px-3 py-2"><Badge tone={b.status === 'Available' ? 'sage' : b.status === 'Issued' ? 'neutral' : 'amber'}>{b.status}</Badge></td>
              </tr>
              </Fragment>))}</tbody>
          </table></div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-muted">
            <span>Page {page + 1} of {pages}</span>
            <span className="flex gap-2"><Button size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Previous</Button><Button size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>Next</Button></span>
          </div>
        )}
      </Panel>

      {dlg && dlg.t === 'new' && <AddBookDialog library={lib} onClose={() => setDlg(null)} />}
      {dlg && (dlg.t === 'transfer' || dlg.t === 'export' || dlg.t === 'remove') && <BookActionDialog kind={dlg.t} library={lib} preselect={sel} onClose={() => { setDlg(null); setSel([]); }} />}
    </div>
  );
}
