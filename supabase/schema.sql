-- Alexandria: database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run. It is safe to run again.

-- 1. One table holds every record (books, students, loans...). "collection" says which kind.
create table if not exists public.records (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists records_collection_idx on public.records (collection);

-- 2. Safety rules the database enforces, even if two devices act at the same moment.
-- A book can have only one open loan: two people cannot both be issued the same copy.
create unique index if not exists one_open_loan_per_book
  on public.records ((data->>'bookId'))
  where collection = 'loans' and (data->>'returnedOn') is null;

-- An accession number is unique within its series. Daily Five (DF) books may share a number with a regular book.
create unique index if not exists unique_accession_per_series
  on public.records (((data->>'accession')::int), ((upper(coalesce(data->>'type', '')) = 'DF')))
  where collection = 'books';

-- 3. Saving: the app sends a batch of changes and they all succeed or all fail together.
create or replace function public.apply_ops(ops jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  op jsonb;
begin
  for op in select * from jsonb_array_elements(ops) loop
    if op->'d' is null or jsonb_typeof(op->'d') = 'null' then
      delete from public.records where collection = op->>'c' and id = op->>'id';
    else
      insert into public.records (collection, id, data, updated_at)
      values (op->>'c', op->>'id', op->'d', now())
      on conflict (collection, id) do update set data = excluded.data, updated_at = now();
    end if;
  end loop;
end;
$$;

-- 4. Who may read and write: only the library logins you create. The public key alone can do nothing.
-- A username such as "sr-library" signs in as sr-library@alexandria-app.com. Only logins on that made-up domain are allowed.
-- IMPORTANT: also turn OFF "Allow new users to sign up" in Supabase > Authentication > Sign In / Providers,
-- so nobody can create their own login.
alter table public.records enable row level security;

drop policy if exists "library staff only" on public.records;
create policy "library staff only" on public.records
  for all to authenticated
  using ((auth.jwt() ->> 'email') like '%@alexandria-app.com')
  with check ((auth.jwt() ->> 'email') like '%@alexandria-app.com');

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;
grant execute on function public.apply_ops(jsonb) to authenticated;

-- 5. Live updates: every device hears about a change as it happens.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
