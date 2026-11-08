-- =============================================================================
-- Konys Pizza · Reglas de validación de datos en la base de datos
-- Son las mismas reglas de js/validacion.js. Aunque alguien se salte la página y
-- llame directo a la API de Supabase, un dato mal formado se rechaza aquí.
--
-- Ya vienen incluidas en esquema.sql. Este archivo es para una base que ya tenía
-- el esquema: Supabase → SQL Editor → pega este archivo → Run. Se puede correr
-- varias veces. Las filas que ya existían no se revisan (NOT VALID), solo las nuevas.
-- =============================================================================

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
