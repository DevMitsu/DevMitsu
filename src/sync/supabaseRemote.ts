import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RemoteError, type Op, type Remote } from './engine';
import type { Change, RemoteRecord } from './records';
import { config } from './config';
import { session } from '../lib/session';

let client: SupabaseClient | null = null;
/** One Supabase client for the whole app. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!config?.url || !config.anonKey) throw new Error('Supabase is not configured.');
    client = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storage: { getItem: (k: string) => session.get(k), setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.remove(k) } } });
  }
  return client;
}

export function classify(error: { code?: string; message?: string; status?: number } | null | undefined): RemoteError {
  const msg = error?.message ?? 'Unknown error';
  const code = error?.code ?? '';
  if (/failed to fetch|networkerror|network request failed|load failed|timeout/i.test(msg)) return new RemoteError('network', msg);
  if (code.startsWith('23')) return new RemoteError('conflict', msg);
  if (code === '42501' || code === 'PGRST301' || /jwt|not authenticated|row-level security/i.test(msg) || error?.status === 401) return new RemoteError('auth', msg);
  return new RemoteError('other', msg);
}

const PAGE = 1000;

export class SupabaseRemote implements Remote {
  async loadAll(): Promise<RemoteRecord[]> {
    const db = supabase();
    const all: RemoteRecord[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('records').select('collection,id,data').order('collection').order('id').range(from, from + PAGE - 1);
      if (error) throw classify(error);
      all.push(...(data as RemoteRecord[]));
      if (!data || data.length < PAGE) break;
    }
    return all;
  }

  async apply(ops: Op[]): Promise<void> {
    const { error } = await supabase().rpc('apply_ops', { ops });
    if (error) throw classify(error);
  }

  subscribe(onChange: (c: Change[]) => void, onConnection: (up: boolean) => void): () => void {
    const db = supabase();
    const channel = db
      .channel('alexandria-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (p) => {
        const row = (p.eventType === 'DELETE' ? p.old : p.new) as { collection?: string; id?: string; data?: unknown };
        if (!row?.collection || !row.id) return;
        onChange([{ collection: row.collection, id: row.id, data: p.eventType === 'DELETE' ? null : row.data }]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onConnection(true);
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onConnection(false);
      });
    return () => { void db.removeChannel(channel); };
  }
}
