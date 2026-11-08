-- =============================================================================
-- Konys Pizza · Sistema de Reservas de Mesas
-- Esquema de base de datos para Supabase (PostgreSQL)
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega este archivo → Run.
-- Antes de ejecutarlo, cambia la contraseña del administrador en la sección 6.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Tablas (modelo de datos §10)
-- -----------------------------------------------------------------------------

-- 10.1 mesas: información de cada mesa del restaurante
create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  zona        text not null check (zona in ('terraza', 'salon')),
  capacidad   int  not null check (capacidad between 1 and 30),
  activa      boolean not null default true,
  foto_url    text,
  creado_en   timestamptz not null default now()
);

-- 10.2 horarios: horario de atención por día de la semana y jornada
create table if not exists public.horarios (
  id            uuid primary key default gen_random_uuid(),
  dia_semana    text not null check (dia_semana in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  jornada       text not null check (jornada in ('almuerzo', 'noche')),
  hora_inicio   time not null,
  hora_fin      time not null,
  duracion_slot int  not null default 60 check (duracion_slot between 15 and 240),
  activo        boolean not null default true,
  check (hora_fin > hora_inicio),
  unique (dia_semana, jornada)
);

-- 10.3 reservas: cada reserva realizada por un cliente
create table if not exists public.reservas (
  id               uuid primary key default gen_random_uuid(),
  mesa_id          uuid not null references public.mesas(id) on delete restrict,
  cliente_nombre   text not null check (char_length(cliente_nombre) between 2 and 80),
  cliente_contacto text check (cliente_contacto is null or char_length(cliente_contacto) <= 40),
  num_personas     int  not null check (num_personas >= 1),
  fecha            date not null,
  hora_inicio      time not null,
  hora_fin         time not null,
  estado           text not null default 'confirmada' check (estado in ('confirmada', 'cancelada', 'completada')),
  creado_en        timestamptz not null default now()
);

-- Evita la doble reserva (§12.2, condición de carrera): una mesa no puede tener dos
-- reservas activas que empiecen a la misma hora el mismo día. Si dos clientes envían
-- la reserva al mismo tiempo, la base de datos rechaza la segunda (error 23505).
create unique index if not exists reservas_slot_unico
  on public.reservas (mesa_id, fecha, hora_inicio)
  where estado <> 'cancelada';

create index if not exists reservas_fecha_idx on public.reservas (fecha);

-- 10.4 platos: carta digital
create table if not exists public.platos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  categoria   text not null check (categoria in ('pizzas', 'entradas', 'postres', 'bebidas')),
  descripcion text,
  precio      int  not null check (precio >= 0),          -- pesos colombianos (COP)
  disponible  boolean not null default true
);

-- Ajustes privados (hash de la contraseña del administrador). Nadie puede leerla desde la API.
create table if not exists public.ajustes (
  clave text primary key,
  valor text not null
);

-- -----------------------------------------------------------------------------
-- 2. Validación de reservas en el servidor (además de la validación en el navegador)
-- -----------------------------------------------------------------------------
-- Mismas reglas que js/validacion.js (también en supabase/validaciones.sql para bases ya creadas)
-- ---------- reservas ----------
alter table public.reservas drop constraint if exists reservas_nombre_valido;
alter table public.reservas add constraint reservas_nombre_valido check (
  char_length(cliente_nombre) between 2 and 80
  and cliente_nombre = btrim(cliente_nombre)
  and cliente_nombre ~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ ''.-]*$'
  and cliente_nombre !~ '[''.-]{2,}'
  and cliente_nombre !~ '  '
  and char_length(regexp_replace(cliente_nombre, '[^A-Za-zÀ-ÖØ-öø-ÿ]', '', 'g')) >= 2
) not valid;

-- Teléfono de Colombia guardado como "300 123 4567" (celular 3xx o fijo 60x)
alter table public.reservas drop constraint if exists reservas_contacto_valido;
alter table public.reservas add constraint reservas_contacto_valido check (
  cliente_contacto is null or cliente_contacto ~ '^(3[0-9]{2}|60[0-9]) [0-9]{3} [0-9]{4}$'
) not valid;

alter table public.reservas drop constraint if exists reservas_personas_valido;
alter table public.reservas add constraint reservas_personas_valido check (num_personas between 1 and 30) not valid;

alter table public.reservas drop constraint if exists reservas_horas_validas;
alter table public.reservas add constraint reservas_horas_validas check (hora_fin > hora_inicio) not valid;

-- ---------- mesas ----------
alter table public.mesas drop constraint if exists mesas_nombre_valido;
alter table public.mesas add constraint mesas_nombre_valido check (
  char_length(nombre) between 2 and 40
  and nombre = btrim(nombre)
  and nombre ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,''()&/#+-]*$'
) not valid;

alter table public.mesas drop constraint if exists mesas_foto_valida;
alter table public.mesas add constraint mesas_foto_valida check (
  foto_url is null or (
    char_length(foto_url) <= 300
    and foto_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]"''`<>\\]*)?$'
  )
) not valid;

-- ---------- platos ----------
alter table public.platos drop constraint if exists platos_nombre_valido;
alter table public.platos add constraint platos_nombre_valido check (
  char_length(nombre) between 2 and 80
  and nombre = btrim(nombre)
  and nombre ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,''()&/#+-]*$'
) not valid;

alter table public.platos drop constraint if exists platos_descripcion_valida;
alter table public.platos add constraint platos_descripcion_valida check (
  descripcion is null or (char_length(descripcion) <= 160 and descripcion !~ '[<>{}\\]')
) not valid;

alter table public.platos drop constraint if exists platos_precio_valido;
alter table public.platos add constraint platos_precio_valido check (precio between 100 and 1000000) not valid;

-- ---------- horarios ----------
alter table public.horarios drop constraint if exists horarios_duracion_valida;
alter table public.horarios add constraint horarios_duracion_valida check (
  duracion_slot % 15 = 0
  and hora_fin - hora_inicio >= make_interval(mins => duracion_slot)
) not valid;

-- ---------- nombres únicos (sin importar mayúsculas) ----------
do $$ begin
  create unique index if not exists mesas_nombre_unico on public.mesas (lower(nombre));
exception when unique_violation then raise notice 'Hay mesas con el mismo nombre: renómbralas y vuelve a correr este archivo.';
end $$;
do $$ begin
  create unique index if not exists platos_nombre_unico on public.platos (lower(nombre));
exception when unique_violation then raise notice 'Hay platos con el mismo nombre: renómbralos y vuelve a correr este archivo.';
end $$;

-- ---------- reglas de la reserva que dependen de otras tablas ----------
create or replace function public.validar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mesas%rowtype;
  hoy date := (now() at time zone 'America/Bogota')::date;
  dia text;
begin
  select * into m from public.mesas where id = new.mesa_id;
  if not found or not m.activa then
    raise exception 'MESA_INACTIVA' using hint = 'La mesa no está disponible para reservas.';
  end if;
  if new.num_personas > m.capacidad then
    raise exception 'CAPACIDAD_SUPERADA' using hint = format('Máximo %s personas para esta mesa.', m.capacidad);
  end if;
  if tg_op = 'INSERT' then
    if new.fecha < hoy then
      raise exception 'FECHA_PASADA';
    end if;
    -- Se reserva hasta 30 días adelante (un día de margen por la zona horaria del navegador)
    if new.fecha > hoy + 31 then
      raise exception 'FECHA_FUERA_DE_RANGO';
    end if;
    -- La hora debe caer dentro de una jornada activa de ese día
    dia := (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from new.fecha)::int + 1];
    if not exists (
      select 1 from public.horarios h
      where h.activo and h.dia_semana = dia
        and new.hora_inicio >= h.hora_inicio and new.hora_fin <= h.hora_fin
    ) then
      raise exception 'FUERA_DE_HORARIO';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reservas_validar on public.reservas;
create trigger reservas_validar
  before insert on public.reservas
  for each row execute function public.validar_reserva();

-- -----------------------------------------------------------------------------
-- 3. Acceso de administrador
--    La contraseña viaja una sola vez (iniciar_sesion) y la base de datos la compara con
--    el hash guardado en "ajustes". Devuelve un token que vence a los 10 minutos; el panel
--    lo envía en el encabezado "x-admin-token". Así la contraseña nunca queda escrita en
--    el código ni guardada en el navegador (RNF-05). Igual que supabase/seguridad.sql.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. Vista pública de horarios ocupados
--    El cliente necesita saber qué slots están ocupados, pero no debe ver
--    nombres ni teléfonos de otros clientes. Esta vista solo expone lo mínimo.
-- -----------------------------------------------------------------------------
create or replace view public.slots_ocupados as
  select mesa_id, fecha, hora_inicio
  from public.reservas
  where estado <> 'cancelada';

grant select on public.slots_ocupados to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security (§14.1)
-- -----------------------------------------------------------------------------
alter table public.mesas    enable row level security;
alter table public.horarios enable row level security;
alter table public.reservas enable row level security;
alter table public.platos   enable row level security;
alter table public.ajustes  enable row level security;   -- sin políticas: nadie la lee por la API

-- mesas: lectura pública; escritura solo administrador
drop policy if exists mesas_leer on public.mesas;
create policy mesas_leer on public.mesas for select using (true);
drop policy if exists mesas_admin on public.mesas;
create policy mesas_admin on public.mesas for all using (public.es_admin()) with check (public.es_admin());

-- horarios: lectura pública; escritura solo administrador
drop policy if exists horarios_leer on public.horarios;
create policy horarios_leer on public.horarios for select using (true);
drop policy if exists horarios_admin on public.horarios;
create policy horarios_admin on public.horarios for all using (public.es_admin()) with check (public.es_admin());

-- platos: el cliente solo ve los disponibles; el administrador ve y edita todos
drop policy if exists platos_leer on public.platos;
create policy platos_leer on public.platos for select using (disponible or public.es_admin());
drop policy if exists platos_admin on public.platos;
create policy platos_admin on public.platos for all using (public.es_admin()) with check (public.es_admin());

-- reservas: cualquiera puede crear una reserva confirmada; solo el administrador la lee o modifica
drop policy if exists reservas_crear on public.reservas;
create policy reservas_crear on public.reservas for insert with check (estado = 'confirmada');
drop policy if exists reservas_admin on public.reservas;
create policy reservas_admin on public.reservas for all using (public.es_admin()) with check (public.es_admin());

-- -----------------------------------------------------------------------------
-- 6. Datos iniciales
-- -----------------------------------------------------------------------------

-- La clave del administrador NO va en este archivo (el repo es público).
-- Después de correr este esquema, en el SQL Editor de Supabase ejecuta aparte,
-- con tu clave, esta línea (no la guardes en ningún archivo):
--
--   insert into public.ajustes (clave, valor)
--   values ('admin_hash', extensions.crypt('TU_CLAVE', extensions.gen_salt('bf')))
--   on conflict (clave) do update set valor = excluded.valor;
--
-- Mientras no lo hagas, nadie puede entrar al panel de administración.

insert into public.mesas (nombre, zona, capacidad, activa) values
  ('Mesa 1', 'terraza', 4, true),
  ('Mesa 2', 'terraza', 2, true),
  ('Mesa 3', 'salon',   6, true),
  ('Mesa 4', 'salon',   4, true),
  ('Mesa 5', 'salon',   8, true),
  ('Mesa 6', 'terraza', 4, true),
  ('Mesa 7', 'salon',   2, true),
  ('Mesa 8', 'terraza', 6, true),
  ('Mesa 9', 'terraza', 4, false)
on conflict do nothing;

-- Horario real de la sede El Prado (Google Maps, nov. 2026), reservas de 60 minutos (RF-11):
-- lunes a sábado 11:30–14:00 y 16:30–23:00; domingo solo 16:30–23:00
insert into public.horarios (dia_semana, jornada, hora_inicio, hora_fin, duracion_slot, activo)
select d, j.jornada, j.inicio, j.fin, 60, true
from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as d
cross join (values ('almuerzo', time '11:30', time '14:00'),
                   ('noche',    time '16:30', time '23:00')) as j(jornada, inicio, fin)
where not (d = 'domingo' and j.jornada = 'almuerzo')
on conflict (dia_semana, jornada) do nothing;

-- Carta real de la sede El Prado (precios de DiDi Food y Rappi, nov. 2026).
-- Todas las pizzas son en cono de 18 cm con 300 g de relleno, masa de finas hierbas,
-- salsa napolitana y mozzarella. La Vegetariana solo está en San Alonso: queda oculta.
insert into public.platos (nombre, categoria, descripcion, precio, disponible) values
  ('Konys Chicken',          'pizzas',   'Pollo en cuadros y maíz.',                                        29900, true),
  ('Konys Mary Tierra',      'pizzas',   'Camarón, pollo, pimentón y maíz.',                                31900, true),
  ('Konys BBQ',              'pizzas',   'Pollo en salsa BBQ y cebolla caramelizada.',                      29900, true),
  ('Konys Hawaiana',         'pizzas',   'Tocineta, jamón ahumado y piña.',                                 29900, true),
  ('Konys Bucara',           'pizzas',   'Carne Angus y mermelada de tocineta ahumada.',                    31900, true),
  ('Konys Carnes',           'pizzas',   'Pepperoni, jamón ahumado y cabano.',                              29900, true),
  ('Konys Mexicana',         'pizzas',   'Carne molida, maíz, pimentón, cebolla y un toque picante.',       29900, true),
  ('Konys Especial',         'pizzas',   'Pollo, tocineta, jamón y champiñón.',                             30900, true),
  ('Konys Marinera',         'pizzas',   'Camarón, pulpo, palmito y salsa especial.',                       31900, true),
  ('Konys Vegetariana',      'pizzas',   'Champiñones, tomate, maíz, cebolla caramelizada y parmesano.',    24000, false),
  ('Papas francesas al horno','entradas','Porción de 200 g, horneadas.',                                    10000, true),
  ('Pan de ajo',             'entradas', 'Porción de pan de ajo.',                                           2500, true),
  ('Limonada de panela',     'bebidas',  'Limonada natural endulzada con panela.',                           7000, true),
  ('Coca-Cola 400 ml',       'bebidas',  'Gaseosa Coca-Cola Original.',                                      5000, true)
on conflict do nothing;
