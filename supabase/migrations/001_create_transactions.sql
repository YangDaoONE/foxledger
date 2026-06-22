create extension if not exists pgcrypto with schema extensions;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'CNY',
  category text not null default '其他',
  tag text,
  merchant text,
  payment_method text,
  account text,
  date date not null default current_date,
  note text,
  raw_text text,
  source text not null default 'manual',
  ai_confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_type_check
    check (type in ('expense', 'income', 'transfer')),
  constraint transactions_amount_positive_check
    check (amount > 0),
  constraint transactions_source_check
    check (source in ('manual', 'ai')),
  constraint transactions_ai_confidence_range_check
    check (
      ai_confidence is null
      or (ai_confidence >= 0 and ai_confidence <= 1)
    )
);

alter table public.transactions enable row level security;

drop policy if exists "Users can select own transactions" on public.transactions;
create policy "Users can select own transactions"
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

create index if not exists transactions_user_id_date_idx
  on public.transactions (user_id, date desc);

create index if not exists transactions_user_id_category_idx
  on public.transactions (user_id, category);

create index if not exists transactions_user_id_created_at_idx
  on public.transactions (user_id, created_at desc);

-- Verification SQL, run these after executing the migration:
-- select to_regclass('public.transactions') as transactions_table;
-- select relrowsecurity from pg_class where oid = 'public.transactions'::regclass;
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'transactions'
-- order by policyname;
