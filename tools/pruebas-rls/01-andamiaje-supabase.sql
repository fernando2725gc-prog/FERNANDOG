-- Reproduce el andamiaje que Supabase da por hecho, para poder probar las
-- políticas en un Postgres de verdad: los roles anon/authenticated, el
-- esquema auth, y auth.uid() leyendo el mismo ajuste que lee allí.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if;
end $$;
grant anon, authenticated to authenticator;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
