create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ledgers_name_trimmed_check
    check (name = btrim(name)),
  constraint ledgers_name_length_check
    check (char_length(name) between 1 and 30),
  constraint ledgers_id_user_id_unique
    unique (id, user_id),
  constraint ledgers_user_name_unique
    unique (user_id, name)
);

alter table public.ledgers enable row level security;

revoke all privileges
  on table public.ledgers
  from anon, authenticated;

grant select, insert, update, delete
  on table public.ledgers
  to authenticated;

create policy "Users can select own ledgers"
  on public.ledgers
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ledgers"
  on public.ledgers
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own ledgers"
  on public.ledgers
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own ledgers"
  on public.ledgers
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.prevent_last_ledger_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.user_id::text, 0)
  );

  if not exists (
    select 1
    from public.ledgers
    where user_id = old.user_id
      and id <> old.id
  ) then
    raise exception 'last ledger cannot be deleted'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_last_ledger_delete on public.ledgers;
create trigger prevent_last_ledger_delete
  before delete on public.ledgers
  for each row
  execute function public.prevent_last_ledger_delete();

drop trigger if exists set_ledgers_updated_at on public.ledgers;
create trigger set_ledgers_updated_at
  before update on public.ledgers
  for each row
  execute function public.set_updated_at();

create index ledgers_user_id_created_at_idx
  on public.ledgers (user_id, created_at);

insert into public.ledgers (user_id, name)
select users.id, '默认账本'
from auth.users as users
on conflict (user_id, name) do nothing;

alter table public.transactions
  add column ledger_id uuid;

update public.transactions as transactions
set ledger_id = ledgers.id
from public.ledgers as ledgers
where ledgers.user_id = transactions.user_id
  and ledgers.name = '默认账本'
  and transactions.ledger_id is null;

do $$
begin
  if exists (
    select 1
    from public.transactions
    where ledger_id is null
  ) then
    raise exception 'transactions ledger backfill incomplete';
  end if;

  if exists (
    select 1
    from public.transactions as transactions
    join public.ledgers as ledgers on ledgers.id = transactions.ledger_id
    where ledgers.user_id <> transactions.user_id
  ) then
    raise exception 'transactions ledger ownership mismatch';
  end if;
end;
$$;

alter table public.transactions
  alter column ledger_id set not null,
  add constraint transactions_ledger_id_fkey
    foreign key (ledger_id, user_id)
    references public.ledgers(id, user_id)
    on delete restrict;

create index transactions_user_id_ledger_id_date_idx
  on public.transactions (user_id, ledger_id, date desc);

create index transactions_user_id_ledger_id_created_at_idx
  on public.transactions (user_id, ledger_id, created_at desc);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.ledgers
      where ledgers.id = transactions.ledger_id
        and ledgers.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.ledgers
      where ledgers.id = transactions.ledger_id
        and ledgers.user_id = (select auth.uid())
    )
  );

-- Verification SQL, run after executing this migration:
-- select count(*) from public.transactions where ledger_id is null;
-- select transactions.id
-- from public.transactions as transactions
-- join public.ledgers as ledgers on ledgers.id = transactions.ledger_id
-- where ledgers.user_id <> transactions.user_id;
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename in ('ledgers', 'transactions')
-- order by tablename, policyname;
