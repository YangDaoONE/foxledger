grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table public.transactions
  to authenticated;

-- Verification SQL, run these after executing the migration:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'transactions'
--   and grantee = 'authenticated'
-- order by privilege_type;
