import { Bell, ChevronsLeft, Menu as MenuIcon, Moon, Plus, Search, Sun, Undo2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons';
import { ConfirmHost, ToastHost, notify } from '../components/toast';
import { Badge, Button, Popover, cx } from '../components/ui';
import { ALL, activeLabs, modulesForLab } from '../domain/inventory';
import { useAlerts } from '../lib/alerts';
import { useApplyPrefs } from '../lib/applyPrefs';
import { scopePath, useScope } from '../lib/scope';
import { openItem, openRecord, useUi } from '../lib/ui';
import { updateSettings } from '../store/actions';
import { STORAGE_LIMIT_CHARS, undo, useMeta, useStore } from '../store/store';
import { RecordEditor } from '../features/records/RecordEditor';
import { ItemDialog } from '../features/inventory/ItemDialog';
import { AdjustDialog, ReceiveDialog, ReceiveRequirementDialog, ReturnDialog, TransferDialog } from '../features/inventory/StockDialogs';
import { ImportDialog } from '../features/inventory/ImportDialog';

export function AppShell() {
  useApplyPrefs();
  const { scope, lab } = useScope();
  const navigate = useNavigate();
  const location = useLocation();
  const state = useStore((s) => s);
  const alerts = useAlerts(scope);
  const meta = useMeta();
  const [nav, setNav] = useState(false);
  const ui = useUi();
  const modules = useMemo(() => modulesForLab(state, scope), [state, scope]);

  // The accent colour follows the lab being looked at
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', lab?.color ?? '#2563eb');
    try { localStorage.setItem('labinventory.scope', scope); } catch { /* ignore */ }
  }, [lab, scope]);
  useEffect(() => setNav(false), [location.pathname]);

  const high = alerts.filter((a) => a.severity === 'high').length;
  const theme = state.settings.theme;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const to = (p = '') => scopePath(scope, p);
  const switchScope = (id: string) => {
    const rest = location.pathname.split('/').slice(2).join('/');
    // Pages tied to one record do not make sense in another lab: go to the list instead
    const keep = rest.startsWith('items/') ? 'items' : rest;
    navigate(scopePath(id, keep) + (keep === rest ? location.search : ''));
  };

  const link = (path: string, label: string, icon: string, badge?: number) => (
    <NavLink key={path} to={to(path)} end={path === ''} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <Badge tone="red">{badge}</Badge> : null}
    </NavLink>
  );
  const heading = (t: string) => <div className="mt-4 mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-faint uppercase">{t}</div>;

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {link('', 'Dashboard', 'activity')}
      {link('alerts', 'Alerts', 'siren', alerts.length)}
      {heading('Inventory')}
      {link('items', 'Items', 'boxes')}
      {link('stocktake', 'Stocktake', 'scale')}
      {link('storage', 'Storage check', 'shield')}
      {heading('Logs & records')}
      {modules.map((m) => link(`m/${m.id}`, m.name, m.icon))}
      {heading('Planning')}
      {link('practicals', 'Practicals', 'flask')}
      {link('reports', 'Reports', 'file')}
      {heading('Directory')}
      {link('directory/people', 'People', 'eye')}
      {link('directory/suppliers', 'Suppliers', 'package')}
      {heading('Set up')}
      {link('customise', 'Customise', 'wrench')}
    </nav>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="no-print border-b bg-surface">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:px-4">
          <button className="btn btn-ghost btn-icon lg:hidden" aria-label="Open menu" onClick={() => setNav(true)}><MenuIcon className="h-5 w-5" /></button>
          <div className="mr-2 hidden items-center gap-2 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: lab?.color ?? 'var(--accent)' }}><Icon name={lab?.icon ?? 'atom'} className="h-4.5 w-4.5" /></span>
            <div className="leading-tight"><div className="text-sm font-semibold">Lab Inventory</div><div className="max-w-40 truncate text-xs text-muted">{state.settings.schoolName}</div></div>
          </div>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <NewMenu />
            <button className="btn btn-ghost btn-icon" aria-label={meta.canUndo ? `Undo: ${meta.undoLabel}` : 'Nothing to undo'} title={meta.canUndo ? `Undo: ${meta.undoLabel}` : 'Nothing to undo'} disabled={!meta.canUndo} onClick={() => { const l = undo(); if (l) notify(`Undid: ${l}`, 'info'); }}><Undo2 className="h-4.5 w-4.5" /></button>
            <button className="btn btn-ghost btn-icon relative" aria-label={`Alerts: ${alerts.length}`} onClick={() => navigate(to('alerts'))}>
              <Bell className="h-4.5 w-4.5" />{high > 0 && <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--c-danger)] px-1 text-[10px] font-bold text-white">{high}</span>}
            </button>
            <button className="btn btn-ghost btn-icon" aria-label="Toggle dark mode" onClick={() => updateSettings({ theme: theme === 'dark' || (theme === 'system' && dark) ? 'light' : 'dark' })}>{dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}</button>
            <WorkingAs />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 sm:px-4" role="tablist" aria-label="Lab">
          {[{ id: ALL, name: 'All labs', color: '#64748b', icon: 'boxes' as string }, ...activeLabs(state).map((l) => ({ id: l.id, name: l.name, color: l.color, icon: l.icon }))].map((l) => {
            const on = l.id === scope;
            return (
              <button key={l.id} role="tab" aria-selected={on} onClick={() => switchScope(l.id)} className={cx('-mb-px flex items-center gap-2 border-b-[3px] px-3 py-2 text-sm font-medium whitespace-nowrap', on ? 'text-ink' : 'border-transparent text-muted hover:text-ink')} style={on ? { borderBottomColor: l.color } : undefined}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.name}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="no-print hidden w-60 shrink-0 border-r bg-surface lg:block">{sidebar}</aside>
        {nav && (
          <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setNav(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-4 py-3"><b>Menu</b><button className="btn btn-ghost btn-icon" aria-label="Close menu" onClick={() => setNav(false)}><ChevronsLeft className="h-4 w-4" /></button></div>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6" id="main">
          {meta.saveError && <div role="alert" className="mb-4 rounded-xl tone-red p-3 text-sm font-medium">{meta.saveError}</div>}
          {!meta.saveError && meta.usedChars > STORAGE_LIMIT_CHARS * 0.7 && (
            <div role="status" className="mb-4 rounded-xl tone-amber p-3 text-sm"><b>Browser storage is {Math.round((meta.usedChars / STORAGE_LIMIT_CHARS) * 100)}% full.</b> Download a backup now. When it fills up, new changes cannot be saved. Removing old log entries or clearing the activity log frees space.</div>
          )}
          <div className="mx-auto max-w-7xl"><Outlet /></div>
        </main>
      </div>

      {ui.record && <RecordEditor key={`${ui.record.moduleId}-${ui.record.id ?? 'new'}`} {...ui.record} />}
      {ui.item && <ItemDialog key={`${ui.item.id ?? 'new'}-${ui.item.duplicate ? 'd' : ''}`} {...ui.item} />}
      {ui.receive && <ReceiveDialog itemId={ui.receive} />}
      {ui.adjust && <AdjustDialog itemId={ui.adjust} />}
      {ui.transfer && <TransferDialog itemId={ui.transfer} />}
      {ui.ret && <ReturnDialog recordId={ui.ret} />}
      {ui.receiveReq && <ReceiveRequirementDialog recordId={ui.receiveReq} />}
      {ui.importLab && <ImportDialog labId={ui.importLab} />}
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}

function NewMenu() {
  const { scope, lab } = useScope();
  const modules = useStore((s) => s.modules);
  const list = useMemo(() => modulesForLab({ modules }, scope), [modules, scope]);
  return (
    <Popover trigger={<><Plus className="h-4 w-4" /> New</>}>
      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface2" onClick={() => openItem({ labId: lab?.id })}><Icon name="boxes" className="h-4 w-4 text-accent" /> Item</button>
      {list.map((m) => (
        <button key={m.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface2" onClick={() => openRecord(m.id, { labId: lab?.id })}><Icon name={m.icon} className="h-4 w-4 text-accent" /> {m.singular}</button>
      ))}
    </Popover>
  );
}

function WorkingAs() {
  const people = useStore((s) => s.people).filter((p) => p.active);
  const me = useStore((s) => s.settings.currentUser);
  return (
    <Popover trigger={<><UserRound className="h-4 w-4" /><span className="hidden max-w-28 truncate sm:inline">{me || 'Working as…'}</span></>}>
      <div className="w-60 p-1">
        <p className="mb-2 text-xs text-muted">Entries and changes are stamped with this name, so the logs show who did what.</p>
        <input className="input mb-2" list="who" placeholder="Your name" defaultValue={me} onBlur={(e) => updateSettings({ currentUser: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <datalist id="who">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        {me && <Button size="sm" variant="ghost" onClick={() => updateSettings({ currentUser: '' })}>Clear</Button>}
      </div>
    </Popover>
  );
}

function GlobalSearch() {
  const { scope } = useScope();
  const items = useStore((s) => s.items);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const t = q.trim().toLowerCase();
  const results = useMemo(
    () => (t ? items.filter((i) => !i.archived && (scope === ALL || i.labId === scope) && `${i.name} ${i.code} ${i.location ?? ''} ${i.tags?.join(' ') ?? ''} ${Object.values(i.custom).join(' ')}`.toLowerCase().includes(t)).slice(0, 8) : []),
    [items, t, scope],
  );
  useEffect(() => setHi(0), [t]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); ref.current?.querySelector('input')?.focus(); } };
    const c = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', k);
    document.addEventListener('mousedown', c);
    return () => { document.removeEventListener('keydown', k); document.removeEventListener('mousedown', c); };
  }, []);
  const go = (id: string, labId: string) => { setOpen(false); setQ(''); navigate(scopePath(scope === ALL ? labId : scope, `items/${id}`)); };
  return (
    <div ref={ref} className="relative order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1 sm:max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-faint" />
      <input className="input pl-8" placeholder="Search items or scan a code…  ( / )" aria-label="Search items" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter') {
            // A scanner types a code and presses Enter: an exact code opens that item straight away
            const exact = items.find((i) => i.code.toLowerCase() === t);
            const pick = exact ?? results[hi];
            if (pick) go(pick.id, pick.labId);
            else if (t) { setOpen(false); navigate(scopePath(scope, `items?q=${encodeURIComponent(q.trim())}`)); }
          } else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLElement).blur(); }
        }} />
      {open && t && (
        <ul role="listbox" className="card absolute z-40 mt-1 w-full overflow-hidden py-1 shadow-xl">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No item matches “{q}”.</li>}
          {results.map((i, n) => (
            <li key={i.id} role="option" aria-selected={n === hi} className={cx('cursor-pointer px-3 py-1.5 text-sm', n === hi && 'bg-accent-soft')} onMouseEnter={() => setHi(n)} onMouseDown={(e) => { e.preventDefault(); go(i.id, i.labId); }}>
              <span className="font-medium">{i.name}</span> <span className="text-xs text-muted">{i.code} · {i.quantity} {i.unit}{i.location ? ` · ${i.location}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
