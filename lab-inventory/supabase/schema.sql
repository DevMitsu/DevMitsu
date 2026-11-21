-- Lab Inventory: database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run. It is safe to run again.
-- It uses its own table (lab_records), so it can share a Supabase project with other apps such as the library system.

-- 1. One table holds every record (items, stock ledger, logs, labs...). "collection" says which kind.
create table if not exists public.lab_records (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists lab_records_collection_idx on public.lab_records (collection);

-- 2. Saving: the app sends a batch of changes and they all succeed or all fail together.
create or replace function public.lab_apply_ops(ops jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  op jsonb;
begin
  for op in select * from jsonb_array_elements(ops) loop
    if op->'d' is null or jsonb_typeof(op->'d') = 'null' then
      delete from public.lab_records where collection = op->>'c' and id = op->>'id';
    else
      insert into public.lab_records (collection, id, data, updated_at)
      values (op->>'c', op->>'id', op->'d', now())
      on conflict (collection, id) do update set data = excluded.data, updated_at = now();
    end if;
  end loop;
end;
$$;

-- 3. Who may read and write: only the staff logins you create. The public key alone can do nothing.
-- A username such as "ms-sharma" signs in as ms-sharma@lab-inventory-app.com. Only logins on that made-up domain are allowed.
-- IMPORTANT: also turn OFF "Allow new users to sign up" in Supabase > Authentication > Sign In / Providers,
-- so nobody can create their own login.
alter table public.lab_records enable row level security;

drop policy if exists "lab staff only" on public.lab_records;
create policy "lab staff only" on public.lab_records
  for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@lab-inventory-app.com')
  with check ((auth.jwt() ->> 'email') like '%@lab-inventory-app.com');

revoke all on public.lab_records from anon;
grant select, insert, update, delete on public.lab_records to authenticated;
grant execute on function public.lab_apply_ops(jsonb) to authenticated;

-- 4. Live updates: make changes appear on every signed-in computer as they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lab_records'
  ) then
    alter publication supabase_realtime add table public.lab_records;
  end if;
end $$;

-- Handy: current stock of every item, worked out from the ledger (the app does the same on every computer).
-- select i.data->>'name' as item, sum((t.data->>'delta')::numeric) as quantity
-- from public.lab_records i
-- join public.lab_records t on t.collection = 'txns' and t.data->>'itemId' = i.id
-- where i.collection = 'items'
-- group by 1 order by 1;
