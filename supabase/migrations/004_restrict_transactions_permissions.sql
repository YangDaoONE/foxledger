revoke all privileges
  on table public.transactions
  from anon, authenticated;

grant select, insert, update, delete
  on table public.transactions
  to authenticated;

-- Verification SQL, run after executing this migration:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'transactions'
--   and grantee in ('anon', 'authenticated')
-- order by grantee, privilege_type;
--
-- Expected rows only:
-- authenticated / DELETE
-- authenticated / INSERT
-- authenticated / SELECT
-- authenticated / UPDATE
