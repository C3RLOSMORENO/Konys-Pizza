-- Prepara un PostgreSQL normal para que se parezca a Supabase
-- (roles anon/authenticated y esquema "extensions"). Solo se usa en CI.
create schema if not exists extensions;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
