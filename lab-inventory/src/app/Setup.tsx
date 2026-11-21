import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../components/icons';
import { Button, Checkbox, Field } from '../components/ui';
import { DEFAULT_LABS } from '../domain/defaults';
import { completeSetup } from '../store/actions';
import { useApplyPrefs } from '../lib/applyPrefs';

export function Setup() {
  useApplyPrefs();
  const [school, setSchool] = useState('');
  const [labs, setLabs] = useState<string[]>(DEFAULT_LABS.map((l) => l.id));
  const [extra, setExtra] = useState('');
  const [sample, setSample] = useState(true);
  const extras = extra.split(',').map((x) => x.trim()).filter(Boolean);
  const none = labs.length === 0 && extras.length === 0;

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="card w-full max-w-xl p-6 shadow-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1f2a44] text-white"><FlaskConical className="h-6 w-6" /></span>
          <div><h1 className="text-xl font-semibold tracking-tight">Welcome to Lab Inventory</h1><p className="text-sm text-muted">Two minutes to set up. You can change everything later.</p></div>
        </div>
        <div className="space-y-5">
          <Field label="School name"><input className="input" autoFocus value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Greenfield Senior Secondary School" /></Field>
          <div>
            <span className="label">Which labs do you want to manage?</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {DEFAULT_LABS.map((l) => {
                const on = labs.includes(l.id);
                return (
                  <button key={l.id} type="button" aria-pressed={on} onClick={() => setLabs((x) => (on ? x.filter((i) => i !== l.id) : [...x, l.id]))}
                    className="flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium" style={{ borderColor: on ? l.color : 'var(--c-line)', background: on ? `color-mix(in srgb, ${l.color} 10%, var(--c-surface))` : undefined }}>
                    <Icon name={l.icon} className="h-5 w-5" style={{ color: l.color }} />{l.name}
                  </button>
                );
              })}
            </div>
            <Field label="Other labs (optional)" className="mt-3" help="Separate several with commas, e.g. Computer Lab, Science Store"><input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
          </div>
          <div className="rounded-xl bg-surface2 p-3">
            <Checkbox checked={sample} onChange={setSample}>Start with sample data so I can explore</Checkbox>
            <p className="help ml-6">Realistic demo items, logs and alerts. One click clears it when you are ready for your own data.</p>
          </div>
          <Button variant="primary" className="w-full py-2.5" disabled={none} onClick={() => completeSetup({ schoolName: school, labIds: labs, extraLabs: extras, sample })}>Open my labs</Button>
          <p className="text-center text-xs text-faint">Your data stays in this browser. Download a backup regularly from Customise → Data.</p>
        </div>
      </div>
    </div>
  );
}
