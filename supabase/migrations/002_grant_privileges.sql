-- =====================
-- GRANT TABLE PRIVILEGES TO API ROLES
-- =====================
--
-- The initial schema enabled row-level security and wrote policies, but it
-- never granted the underlying table privileges to the roles the Supabase
-- client connects as (`anon` for logged-out requests, `authenticated` for
-- logged-in ones). Postgres checks GRANTs *before* RLS, so every request was
-- rejected with:
--
--     permission denied for table households   (SQLSTATE 42501)
--
-- on the signup page. RLS is still what actually protects the data -- these
-- grants only let the roles reach the tables so the policies can be evaluated.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant usage, select
  on all sequences in schema public
  to anon, authenticated;

-- Cover any tables/sequences created in the future too, so we don't reopen
-- this hole the next time a table is added.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
