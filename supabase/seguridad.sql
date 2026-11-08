-- =============================================================================
-- Konys Pizza · Sesiones del administrador que vencen a los 10 minutos
--
-- La contraseña viaja una sola vez, al iniciar sesión. La base de datos entrega un
-- token aleatorio que vence a los 10 minutos, y el navegador guarda solo ese token.
-- En cada petición, es_admin() comprueba que el token exista y no haya vencido.
-- Después de 5 intentos fallidos se bloquea el acceso por 10 minutos.
--
-- Ya viene incluido en esquema.sql. Este archivo es para una base que ya tenía el
-- esquema: Supabase → SQL Editor → pega este archivo → Run. Se puede correr varias veces.
-- =============================================================================

create table if not exists public.sesiones_admin (
  token  uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  expira timestamptz not null
);

create table if not exists public.intentos_acceso (
  id     bigserial primary key,
  en     timestamptz not null default now(),
  exito  boolean not null
);

-- Nadie las lee ni las modifica por la API: solo las funciones de abajo
alter table public.sesiones_admin  enable row level security;
alter table public.intentos_acceso enable row level security;
revoke all on public.sesiones_admin, public.intentos_acceso from anon, authenticated;

-- Versiones anteriores comprobaban la contraseña en cada petición (encabezado x-admin-clave)
drop function if exists public.verificar_admin();
drop function if exists public.iniciar_sesion(text);
drop function if exists public.cerrar_sesion();

-- ¿La petición trae un token de sesión vigente? (encabezado HTTP "x-admin-token")
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sesiones_admin s
    where s.token::text = coalesce(current_setting('request.headers', true)::json ->> 'x-admin-token', '')
      and s.expira > now()
  );
$$;

-- Inicia sesión: si la contraseña es correcta devuelve {token, segundos}; si no, null.
create or replace function public.iniciar_sesion(p_clave text)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_fallidos int;
  v_token uuid;
  v_expira timestamptz;
begin
  -- Limpieza de sesiones vencidas e intentos viejos
  delete from public.sesiones_admin where expira <= now();
  delete from public.intentos_acceso where en < now() - interval '1 day';

  -- Bloqueo por fuerza bruta: 5 fallos seguidos en los últimos 10 minutos
  select count(*) into v_fallidos
  from public.intentos_acceso
  where not exito
    and en > now() - interval '10 minutes'
    and en > coalesce((select max(en) from public.intentos_acceso where exito), '-infinity');
  if v_fallidos >= 5 then
    raise exception 'BLOQUEADO' using hint = 'Demasiados intentos fallidos. Espera 10 minutos.';
  end if;

  select valor into v_hash from public.ajustes where clave = 'admin_hash';
  if v_hash is null or p_clave is null or char_length(p_clave) > 72
     or extensions.crypt(p_clave, v_hash) <> v_hash then
    insert into public.intentos_acceso (exito) values (false);
    return null;
  end if;

  insert into public.intentos_acceso (exito) values (true);
  v_expira := now() + interval '10 minutes';
  insert into public.sesiones_admin (expira) values (v_expira) returning token into v_token;
  return json_build_object('token', v_token, 'segundos', 600);
end;
$$;

-- Usada al recargar el panel: ¿el token sigue vigente?
create or replace function public.verificar_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.es_admin(); $$;

-- Cierra la sesión: el token deja de servir aunque alguien lo haya copiado
create or replace function public.cerrar_sesion()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.sesiones_admin
  where token::text = coalesce(current_setting('request.headers', true)::json ->> 'x-admin-token', '');
$$;

revoke all on function public.iniciar_sesion(text), public.verificar_admin(), public.cerrar_sesion() from public;
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.iniciar_sesion(text) to anon, authenticated;
grant execute on function public.verificar_admin() to anon, authenticated;
grant execute on function public.cerrar_sesion() to anon, authenticated;
