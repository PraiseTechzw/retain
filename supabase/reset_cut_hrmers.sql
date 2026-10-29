-- DESTRUCTIVE: Run this only in the CUT development database when you are
-- ready to permanently remove the old CUT-ELAMS schema and all of its data.
-- Do not run in production without a verified backup and written approval.
--
-- After this file completes, run these files in order:
-- 1. migrations/20261029000000_cut_hrmers_baseline.sql
-- 2. migrations/20261029000100_cut_hrmers_rls.sql
-- 3. migrations/20261029000200_grant_authenticated_table_access.sql
-- 4. migrations/20261029000300_create_profiles_for_auth_users.sql
-- 5. migrations/20261029000400_add_system_administration_storage.sql
-- 6. migrations/20261029000500_add_leave_reviewed_at.sql
-- 7. seed.sql (development data only)

begin;

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

commit;
