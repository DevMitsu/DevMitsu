import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { toast } from '../../components/ui/toast';
import type { Prefs } from '../../domain/types';
import { cn } from '../../lib/cn';
import { backupJson, setPrefs } from '../../store/actions';
import { useStore } from '../../store/store';

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-6" aria-label={title}>
      <Panel>
        <div className="border-b border-line bg-canvas px-5 py-3"><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}</div>
        <div className="space-y-5 p-5">{children}</div>
      </Panel>
    </section>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string; icon?: ReactNode; hint?: string }>; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={cn('flex min-w-36 cursor-pointer items-start gap-2 rounded-control border px-3 py-2.5 text-sm', value === o.value ? 'border-primary bg-sage-soft' : 'border-line hover:bg-sage-soft/50')}>
            <input type="radio" name={label} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 accent-[var(--color-primary)]" />
            <span><span className="flex items-center gap-1.5 font-medium">{o.icon}{o.label}</span>{o.hint && <span className="block text-xs text-muted">{o.hint}</span>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPage() {
  const prefs = useStore((s) => s.prefs);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs({ [k]: v } as Partial<Prefs>);

  const copy = async () => { try { await navigator.clipboard.writeText(backupJson()); toast('Backup copied. Paste it into a text file and keep it safe.'); } catch { toast('Copying was blocked here.', { tone: 'error' }); } };
  const download = () => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(new Blob([backupJson()], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `alexandria-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Download started. If nothing downloads here, use Copy backup instead.');
    } catch { toast('Download is not available here. Use Copy backup instead.', { tone: 'error' }); }
    setBusy(false);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How the app looks and how it behaves on this device. Lending rules, teacher dues and note options are in Miscellaneous." />

      <Group title="Appearance">
        <Choice label="Theme" value={prefs.theme} onChange={(v) => set('theme', v)} options={[
          { value: 'light', label: 'Light', icon: <Sun className="size-4" aria-hidden /> },
          { value: 'dark', label: 'Dark', icon: <Moon className="size-4" aria-hidden />, hint: 'Easier on the eyes in the evening' },
          { value: 'system', label: 'Same as device', icon: <Monitor className="size-4" aria-hidden /> },
        ]} />
        <Choice label="Text size" value={prefs.textSize} onChange={(v) => set('textSize', v)} options={[{ value: 'normal', label: 'Standard' }, { value: 'large', label: 'Large', hint: 'About 12% bigger' }]} />
        <Checkbox checked={prefs.compact} onChange={(v) => set('compact', v)} label="Compact tables" description="Tighter rows, so more students or books fit on screen." />
      </Group>

      <Group title="Issuing and returning">
        <Choice label="When Issue / Return opens" value={prefs.issueMode} onChange={(v) => set('issueMode', v)} options={[
          { value: 'one', label: 'One book at a time', hint: 'Scan a book and it is issued or returned straight away' },
          { value: 'several', label: 'Several at once', hint: 'Build a list, then confirm everything together' },
        ]} />
        <Checkbox checked={prefs.keepOpen} onChange={(v) => set('keepOpen', v)} label="Stay open after each book" description="Ready for the next scan. Turn off to close after every book." />
        <Checkbox checked={prefs.warnOverdue} onChange={(v) => set('warnOverdue', v)} label="Warn me about overdue books and unpaid fines before issuing" />
        <Checkbox checked={prefs.blockOverdue} onChange={(v) => set('blockOverdue', v)} disabled={!prefs.warnOverdue} label="Don’t allow a new issue while a book is overdue" description="A student must return or settle first." />
      </Group>

      <Group title="Home">
        <Choice label="Timetable opens in" value={prefs.timetableView} onChange={(v) => set('timetableView', v)} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }]} />
      </Group>

      <Group title="Your data" description="Everything in this prototype lives in this browser. A backup is a copy you can keep.">
        <div className="flex flex-wrap gap-2">
          <Button icon={<Copy className="size-4" aria-hidden />} onClick={copy}>Copy backup</Button>
          <Button icon={<Download className="size-4" aria-hidden />} onClick={download} loading={busy}>Download backup</Button>
        </div>
        <p className="text-xs text-muted">The backup leaves out passwords. To start again with fresh dummy data, use <Link to="/misc" className="text-accent underline">Miscellaneous → Demo data</Link>.</p>
      </Group>
    </div>
  );
}
