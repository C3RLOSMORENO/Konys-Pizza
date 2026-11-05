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
create or replace function public.validar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mesas%rowtype;
begin
  select * into m from public.mesas where id = new.mesa_id;
  if not found or not m.activa then
    raise exception 'MESA_INACTIVA' using hint = 'La mesa no está disponible para reservas.';
  end if;
  if new.num_personas > m.capacidad then
    raise exception 'CAPACIDAD_SUPERADA' using hint = format('Máximo %s personas para esta mesa.', m.capacidad);
  end if;
  if tg_op = 'INSERT' and new.fecha < (now() at time zone 'America/Bogota')::date then
    raise exception 'FECHA_PASADA';
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
--    El panel envía la contraseña en el encabezado HTTP "x-admin-clave".
--    La base de datos la compara con el hash guardado en "ajustes".
--    Así la contraseña nunca queda escrita en el código del repositorio (RNF-05).
-- -----------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.ajustes a
    where a.clave = 'admin_hash'
      and a.valor = extensions.crypt(
        coalesce(current_setting('request.headers', true)::json ->> 'x-admin-clave', ''),
        a.valor)
  );
$$;

-- Usada por la pantalla de acceso (/admin) para comprobar la contraseña.
create or replace function public.verificar_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.es_admin(); $$;

grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.verificar_admin() to anon, authenticated;

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
  ('Mesa 9', 'terraza', 4, false);

-- Dos jornadas todos los días: 12:30–14:30 y 17:00–23:00, reservas de 60 minutos (RF-11)
insert into public.horarios (dia_semana, jornada, hora_inicio, hora_fin, duracion_slot, activo)
select d, j.jornada, j.inicio, j.fin, 60, true
from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as d
cross join (values ('almuerzo', time '12:30', time '14:30'),
                   ('noche',    time '17:00', time '23:00')) as j(jornada, inicio, fin)
on conflict (dia_semana, jornada) do nothing;

insert into public.platos (nombre, categoria, descripcion, precio, disponible) values
  ('Pizza Konys Especial', 'pizzas',   'Pepperoni, jamón, champiñones, maíz tierno y queso mozzarella.', 38000, true),
  ('Pizza Hawaiana',       'pizzas',   'Jamón, piña caramelizada y queso mozzarella.',                    32000, true),
  ('Pizza Pepperoni',      'pizzas',   'Doble pepperoni, salsa de tomate de la casa y orégano.',          34000, true),
  ('Pizza Vegetariana',    'pizzas',   'Pimentón, cebolla morada, aceitunas, champiñones y tomate.',      31000, true),
  ('Pizza Mexicana',       'pizzas',   'Carne molida, jalapeños, fríjol, maíz y nachos.',                 36000, true),
  ('Pizza Margarita',      'pizzas',   'Tomate, albahaca fresca y mozzarella.',                           29000, true),
  ('Pan de ajo',           'entradas', 'Pan artesanal con mantequilla de ajo y finas hierbas.',           12000, true),
  ('Alitas BBQ',           'entradas', '8 alitas en salsa BBQ con papas a la francesa.',                  24000, true),
  ('Palitos de queso',     'entradas', 'Masa de la casa rellena de mozzarella, con salsa napolitana.',    15000, true),
  ('Brownie con helado',   'postres',  'Brownie tibio de chocolate con helado de vainilla.',              14000, true),
  ('Postre de tres leches','postres',  'Bizcocho húmedo con crema batida y canela.',                      12000, false),
  ('Limonada de coco',     'bebidas',  'Limonada natural con crema de coco.',                             10000, true),
  ('Jugo natural',         'bebidas',  'Mango, mora o lulo, en agua o en leche.',                          8000, true),
  ('Gaseosa 400 ml',       'bebidas',  'Variedad de sabores.',                                             5000, true);
