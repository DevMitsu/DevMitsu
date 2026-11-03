import { config, emailFor } from './config';
import { supabase } from './supabaseRemote';

export interface TestResult { label: string; ok: boolean; hint?: string }

/** Checks each part of the Supabase setup and says what to fix. */
export async function runConnectionTest(): Promise<TestResult[]> {
  if (!config) return [{ label: 'Connection configured', ok: false, hint: 'Enter the Supabase URL and key first.' }];
  if (config.mode === 'memory') return [{ label: 'Stand-in database (shared between tabs of this browser)', ok: true }];

  const db = supabase();
  const out: TestResult[] = [];

  const reach = await db.from('records').select('id', { count: 'exact', head: true });
  if (reach.error) {
    const m = reach.error.message || '';
    out.push({
      label: 'Reach the database and the records table', ok: false,
      hint: /fetch|network/i.test(m) ? 'The database could not be reached. Check the internet connection and that the URL is exactly the Project URL from Supabase.'
        : /does not exist|schema cache|PGRST205|404/i.test(m + (reach.error.code ?? '')) ? 'The records table is missing. Run supabase/schema.sql in the Supabase SQL Editor.'
        : /jwt|401|permission|denied|row-level/i.test(m + (reach.error.code ?? '')) ? 'The database refused access. Make sure you are signed in with the library login and that schema.sql was run.'
        : m,
    });
    return out;
  }
  out.push({ label: 'Reach the database and the records table', ok: true });

  const user = (await db.auth.getUser()).data.user;
  const emails = Object.values(config.usernames).map((u) => emailFor(u));
  out.push({ label: 'Signed in with a library login', ok: !!user?.email && emails.includes(user.email.toLowerCase()), hint: `Sign in with the username ${config.usernames.sr}. In Supabase the user's email must be ${emailFor(config.usernames.sr)}.` });

  const id = `_test_${Math.random().toString(36).slice(2, 8)}`;
  const save = await db.rpc('apply_ops', { ops: [{ c: 'meta', id, d: { at: new Date().toISOString() } }] });
  out.push({
    label: 'Save a record', ok: !save.error,
    hint: save.error ? (/apply_ops/i.test(save.error.message) ? 'The save function is missing. Run supabase/schema.sql again.' : /row-level|permission/i.test(save.error.message) ? 'The login is not allowed to save. Check that the login email matches the one in schema.sql.' : save.error.message) : undefined,
  });

  // live updates: subscribe, then change the test record and wait to hear it
  const live = await new Promise<{ subscribed: boolean; heard: boolean }>((resolve) => {
    let subscribed = false;
    let heard = false;
    const channel = db.channel(`test-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (p) => {
      const row = (p.new ?? p.old) as { id?: string };
      if (row?.id === id) { heard = true; finish(); }
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        await db.rpc('apply_ops', { ops: [{ c: 'meta', id, d: { again: true } }] });
        setTimeout(finish, 5000);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') finish();
    });
    let done = false;
    function finish() { if (done) return; done = true; void db.removeChannel(channel); resolve({ subscribed, heard }); }
    setTimeout(finish, 9000);
  });
  out.push({ label: 'Connect for live updates', ok: live.subscribed, hint: 'Realtime did not connect. In Supabase open Database > Replication and turn on the records table, or run schema.sql again.' });
  out.push({ label: 'Hear a change as it happens', ok: live.heard, hint: live.subscribed ? 'Live updates are on but the change was not heard. Turn on Realtime for the records table, then try again.' : 'Fix the step above first.' });

  await db.rpc('apply_ops', { ops: [{ c: 'meta', id, d: null }] });
  return out;
}
