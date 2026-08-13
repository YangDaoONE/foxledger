alter table public.transactions
  add column if not exists ai_batch_id uuid;

alter table public.transactions
  drop constraint if exists transactions_ai_batch_source_check;

alter table public.transactions
  add constraint transactions_ai_batch_source_check
  check (ai_batch_id is null or source = 'ai');

create index if not exists transactions_user_id_ai_batch_id_created_at_idx
  on public.transactions (user_id, ai_batch_id, created_at desc)
  where ai_batch_id is not null;

-- Verification SQL, run these after executing the migration:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'transactions'
--   and column_name = 'ai_batch_id';
--
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.transactions'::regclass
--   and conname = 'transactions_ai_batch_source_check';
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'transactions'
--   and indexname = 'transactions_user_id_ai_batch_id_created_at_idx';
--
-- select relrowsecurity
-- from pg_class
-- where oid = 'public.transactions'::regclass;
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'transactions'
-- order by policyname;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'transactions'
--   and grantee = 'authenticated'
-- order by privilege_type;

-- RLS acceptance must use two authenticated test users:
-- 1. User A inserts rows with one ai_batch_id and can select/delete that batch.
-- 2. User B cannot select or delete User A's rows, even with the known ai_batch_id.
