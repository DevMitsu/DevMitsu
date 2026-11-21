import { ArrowLeft, ArrowLeftRight, Boxes, ClipboardList, Copy, Droplets, Hammer, Pencil, PackagePlus, Scale, ShoppingCart, Trash2, Wrench, ArchiveRestore } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Menu, Meter, Tabs } from '../../components/ui';
import { FieldValue } from '../../components/FieldInputs';
import { Icon } from '../../components/icons';
import { attempt, confirmDialog, tryDo } from '../../components/toast';
import { fmtDate, fmtDateTime, relDays, todayStr } from '../../domain/dates';
import { TXN_LABEL, outOnLoan, stockValue } from '../../domain/inventory';
import { scopePath, useScope } from '../../lib/scope';
import { openItem, openRecord, setUi } from '../../lib/ui';
import { bulkUpdateItems, deleteItem, duplicateItem } from '../../store/actions';
import { useStore } from '../../store/store';
import { recordDate, mentionsItem } from '../records/helpers';
import { HazardBadges, StatusBadge, expiryBadge, makeCtx, serviceBadge } from './columns';

export function ItemDetailPage() {
  const { id } = useParams();
  const { scope } = useScope();
  const navigate = useNavigate();
  const state = useStore((s) => s);
  const item = state.items.find((i) => i.id === id);
  const [tab, setTab] = useState<'history' | 'logs'>('history');
  const out = useMemo(() => outOnLoan(state.records), [state.records]);
  const ctx = useMemo(() => makeCtx(state, out), [state, out]);

  const txns = useMemo(() => state.txns.filter((t) => t.itemId === id).reverse(), [state.txns, id]);
  const logs = useMemo(
    () => state.records.filter((r) => item && mentionsItem(r, item.id)).sort((a, b) => recordDate(state.modules.find((m) => m.id === b.moduleId), b).localeCompare(recordDate(state.modules.find((m) => m.id === a.moduleId), a))),
    [state.records, state.modules, item],
  );

  if (!item) {
    return <Card><EmptyState icon="boxes" title="This item no longer exists" action={<Button onClick={() => navigate(scopePath(scope, 'items'))}>Back to inventory</Button>}>It may have been deleted.</EmptyState></Card>;
  }
  const cat = state.categories.find((c) => c.id === item.categoryId);
  const lab = state.labs.find((l) => l.id === item.labId);
  const onLoan = out.get(item.id) ?? 0;
  const mods = state.modules.filter((m) => m.enabled && (m.labIds.length === 0 || m.labIds.includes(item.labId)));
  const has = (kind: string) => mods.find((m) => m.kind === kind);
  const act = (kind: string, prefill: Record<string, unknown> = {}) => {
    const m = has(kind);
    if (m) openRecord(m.id, { labId: item.labId, prefill: { item: item.id, ...prefill } as never });
  };
  const back = Math.round((item.quantity - onLoan) * 1e6) / 1e6;
  const meterMax = Math.max(item.targetStock ?? 0, (item.minStock ?? 0) * 2, item.quantity, 1);
  const low = item.minStock != null && item.minStock > 0 && item.quantity <= item.minStock;

  const detail = (label: string, value: React.ReactNode) => (
    <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 text-sm break-words">{value ?? <span className="text-faint">—</span>}</dd></div>
  );

  const remove = async () => {
    if (await confirmDialog({ title: `Delete ${item.name}?`, body: 'This removes the item and its stock history for good. Entries in the logs that mention it will show "(removed item)". If you only want it out of the way, archive it instead.', confirm: 'Delete item', danger: true })) {
      if (tryDo(() => deleteItem(item.id), 'Item deleted')) navigate(scopePath(scope, 'items'));
    }
  };

  return (
    <div>
      <Link to={scopePath(scope, 'items')} className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Inventory</Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{item.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-mono text-xs">{item.code}</span>
            {lab && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: lab.color }} />{lab.name}</span>}
            <span>·</span><span>{cat?.name}</span>
            <StatusBadge item={item} state={state} />
            {item.archived && <Badge>archived</Badge>}
          </div>
          {item.hazards?.length ? <div className="mt-2"><HazardBadges item={item} state={state} /></div> : null}
        </div>
        <div className="no-print flex items-center gap-2">
          <Button onClick={() => openItem({ id: item.id })}><Pencil className="h-4 w-4" /> Edit</Button>
          <Menu items={[
            { label: <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Duplicate</span>, onClick: () => { const nid = attempt(() => duplicateItem(item.id)); if (nid) { navigate(scopePath(scope, `items/${nid}`)); openItem({ id: nid }); } } },
            { label: <span className="flex items-center gap-2"><ArchiveRestore className="h-4 w-4" /> {item.archived ? 'Restore' : 'Archive'}</span>, onClick: () => tryDo(() => bulkUpdateItems([item.id], { archived: !item.archived }), item.archived ? 'Restored' : 'Archived') },
            { label: <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete…</span>, danger: true, onClick: remove },
          ]} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="text-xs font-medium text-muted">In stock</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums">{item.quantity}</span>
              <span className="text-lg text-muted">{item.unit}</span>
              {low && <Badge tone={item.quantity <= 0 ? 'red' : 'amber'}>{item.quantity <= 0 ? 'Out of stock' : 'Low'}</Badge>}
            </div>
            {onLoan > 0 && <p className="mt-1 text-sm text-muted">{onLoan} {item.unit} out on loan · {back} {item.unit} on the shelf</p>}
            <div className="mt-3">
              <Meter value={item.quantity} max={meterMax} tone={low ? 'amber' : 'blue'} />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{item.minStock != null ? `Reorder at ${item.minStock}` : 'No reorder level'}</span>
                {item.targetStock != null && <span>Fill to {item.targetStock}</span>}
              </div>
            </div>
            {item.unitCost != null && <p className="mt-2 text-sm text-muted">Worth {state.settings.currency}{Math.round(stockValue(item)).toLocaleString('en-IN')} at {state.settings.currency}{item.unitCost}/{item.unit}</p>}
          </Card>

          <Card className="no-print">
            <h2 className="mb-2 text-sm font-semibold">Do something with this item</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setUi({ receive: item.id })}><PackagePlus className="h-4 w-4" /> Receive stock</Button>
              {has('usage') && <Button onClick={() => act('usage')}><ClipboardList className="h-4 w-4" /> Record use</Button>}
              <Button onClick={() => setUi({ adjust: item.id })}><Scale className="h-4 w-4" /> Correct count</Button>
              <Button onClick={() => setUi({ transfer: item.id })}><ArrowLeftRight className="h-4 w-4" /> Transfer</Button>
              {has('spill') && cat?.kind === 'consumable' && <Button onClick={() => act('spill', { when: `${todayStr()}T${new Date().toTimeString().slice(0, 5)}` })}><Droplets className="h-4 w-4" /> Report spill</Button>}
              {has('breakage') && <Button onClick={() => act('breakage')}><Hammer className="h-4 w-4" /> Broken / lost</Button>}
              {has('disposal') && <Button onClick={() => act('disposal')}><Trash2 className="h-4 w-4" /> Dispose</Button>}
              {has('loan') && cat?.kind === 'asset' && <Button onClick={() => act('loan')}><Boxes className="h-4 w-4" /> Issue on loan</Button>}
              {has('maintenance') && <Button onClick={() => act('maintenance')}><Wrench className="h-4 w-4" /> Log maintenance</Button>}
              {has('requisition') && <Button onClick={() => act('requisition', { name: item.name, unit: item.unit, supplier: item.supplier, quantity: Math.max(1, (item.targetStock ?? (item.minStock ?? 0) * 2) - item.quantity) })}><ShoppingCart className="h-4 w-4" /> Request more</Button>}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {detail('Location', item.location)}
              {detail('Supplier', item.supplier)}
              {detail('Purchased', item.purchaseDate ? fmtDate(item.purchaseDate) : undefined)}
              {cat?.trackExpiry && detail('Expiry', item.expiry ? <span className="inline-flex items-center gap-2">{expiryBadge(item, ctx)} <span className="text-xs text-muted">{relDays(item.expiry)}</span></span> : undefined)}
              {cat?.trackExpiry && detail('Lot / batch', item.lot)}
              {cat?.hazardous && detail('Storage group', item.storageGroup)}
              {cat?.trackService && detail('Service interval', item.serviceEveryDays ? `Every ${item.serviceEveryDays} days` : undefined)}
              {cat?.trackService && detail('Last serviced', item.lastServiced ? fmtDate(item.lastServiced) : undefined)}
              {cat?.trackService && detail('Next service', item.nextServiceDue ? serviceBadge(item, ctx) : undefined)}
              {(cat?.fields ?? []).map((f) => detail(f.label, item.custom[f.id] === undefined || item.custom[f.id] === '' ? undefined : <FieldValue def={f} value={item.custom[f.id]} scope={scope} />))}
              {item.tags?.length ? detail('Tags', item.tags.join(', ')) : null}
              {detail('Added', fmtDateTime(item.createdAt))}
            </dl>
            {(item.description || item.notes) && (
              <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                {item.description && <p>{item.description}</p>}
                {item.notes && <p className="whitespace-pre-wrap text-muted">{item.notes}</p>}
              </div>
            )}
          </Card>

          <div>
            <Tabs tabs={[{ id: 'history', label: 'Stock history', count: txns.length }, { id: 'logs', label: 'Logs & records', count: logs.length }]} value={tab} onChange={setTab} />
            <Card pad={false} className="overflow-x-auto">
              {tab === 'history' ? (
                txns.length === 0 ? <EmptyState icon="clipboard" title="No stock movements yet">Receiving, using or correcting stock shows up here.</EmptyState> : (
                  <table className="tbl">
                    <thead><tr><th>When</th><th>What</th><th className="text-right">Change</th><th className="text-right">Balance</th><th>Note</th><th>By</th></tr></thead>
                    <tbody>
                      {txns.slice(0, 200).map((t) => (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap">{fmtDateTime(t.at)}</td>
                          <td>{TXN_LABEL[t.type]}</td>
                          <td className="text-right tabular-nums"><span style={{ color: t.delta < 0 ? 'var(--t-red-fg)' : 'var(--t-green-fg)' }}>{t.delta > 0 ? '+' : ''}{t.delta}</span></td>
                          <td className="text-right tabular-nums">{t.balance}</td>
                          <td className="text-muted">{t.note ?? ''}</td>
                          <td className="text-muted">{t.by ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : logs.length === 0 ? <EmptyState icon="clipboard" title="Nothing logged for this item">Usage, spills, loans, maintenance and accidents that mention it appear here.</EmptyState> : (
                <table className="tbl">
                  <thead><tr><th>Log</th><th>Date</th><th>Details</th></tr></thead>
                  <tbody>
                    {logs.map((r) => {
                      const m = state.modules.find((x) => x.id === r.moduleId);
                      const q = r.values.quantity;
                      return (
                        <tr key={r.id} className="clickable" onClick={() => openRecord(r.moduleId, { id: r.id })}>
                          <td><span className="inline-flex items-center gap-1.5 font-medium"><Icon name={m?.icon} className="h-4 w-4 text-muted" />{m?.singular}</span></td>
                          <td className="whitespace-nowrap">{fmtDateTime(recordDate(m, r))}</td>
                          <td className="text-muted">{[q != null ? `${q} ${item.unit}` : '', r.values.type ?? r.values.title ?? r.values.name, r.values.practical, r.values.borrower, r.values.severity].filter(Boolean).join(' · ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
