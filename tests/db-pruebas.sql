-- Pruebas del esquema de supabase/esquema.sql. Se corren en CI con psql -v ON_ERROR_STOP=1:
-- si alguna falla, el bloque lanza una excepción y el job queda en rojo.

-- Datos iniciales
do $$ begin
  if (select count(*) from mesas) <> 9 then raise exception 'Se esperaban 9 mesas'; end if;
  if (select count(*) from horarios) <> 13 then raise exception 'Se esperaban 13 horarios'; end if;
  if (select count(*) from platos) <> 14 then raise exception 'Se esperaban 14 platos'; end if;
end $$;

-- El esquema no trae clave de admin: mientras no se configure, nadie entra al panel
set role anon;
select set_config('request.headers', '{"x-admin-clave":"konys2026"}', false);
do $$ begin
  if public.verificar_admin() then raise exception 'Hay una clave de admin por defecto en el esquema'; end if;
end $$;
reset role;

-- Clave temporal que solo existe en el Postgres del CI
insert into ajustes (clave, valor) values ('admin_hash', extensions.crypt('clave-solo-para-ci', extensions.gen_salt('bf')));

-- A partir de aquí actuamos como un visitante sin contraseña (rol anon de Supabase)
set role anon;
select set_config('request.headers', '{}', false);

do $$ begin
  if (select count(*) from platos) <> 13 then raise exception 'El público ve platos ocultos'; end if;
  if (select count(*) from ajustes) <> 0 then raise exception 'El público puede leer el hash de la contraseña'; end if;
  if public.verificar_admin() then raise exception 'verificar_admin aceptó una petición sin clave'; end if;
end $$;

-- El público puede crear una reserva válida
insert into reservas (mesa_id, cliente_nombre, num_personas, fecha, hora_inicio, hora_fin)
select id, 'Prueba CI', 4, current_date + 2, '19:00', '20:00' from mesas where nombre = 'Mesa 3';

do $$ begin
  if (select count(*) from reservas) <> 0 then raise exception 'El público puede leer reservas ajenas'; end if;
  if (select count(*) from slots_ocupados) <> 1 then raise exception 'La vista slots_ocupados no muestra el horario ocupado'; end if;
end $$;

-- Doble reserva del mismo horario (§12.2)
do $$
declare rechazada boolean := false;
begin
  begin
    insert into reservas (mesa_id, cliente_nombre, num_personas, fecha, hora_inicio, hora_fin)
    select id, 'Otra persona', 2, current_date + 2, '19:00', '20:00' from mesas where nombre = 'Mesa 3';
  exception when unique_violation then rechazada := true;
  end;
  if not rechazada then raise exception 'Se permitió una doble reserva'; end if;
end $$;

-- Capacidad superada
do $$
declare rechazada boolean := false;
begin
  begin
    insert into reservas (mesa_id, cliente_nombre, num_personas, fecha, hora_inicio, hora_fin)
    select id, 'Grupo grande', 9, current_date + 2, '20:00', '21:00' from mesas where nombre = 'Mesa 3';
  exception when others then rechazada := sqlerrm = 'CAPACIDAD_SUPERADA';
  end;
  if not rechazada then raise exception 'No se validó la capacidad de la mesa'; end if;
end $$;

-- Mesa inactiva (Mesa 9)
do $$
declare rechazada boolean := false;
begin
  begin
    insert into reservas (mesa_id, cliente_nombre, num_personas, fecha, hora_inicio, hora_fin)
    select id, 'Prueba', 2, current_date + 2, '19:00', '20:00' from mesas where nombre = 'Mesa 9';
  exception when others then rechazada := sqlerrm = 'MESA_INACTIVA';
  end;
  if not rechazada then raise exception 'Se reservó una mesa inactiva'; end if;
end $$;

-- Fecha pasada
do $$
declare rechazada boolean := false;
begin
  begin
    insert into reservas (mesa_id, cliente_nombre, num_personas, fecha, hora_inicio, hora_fin)
    select id, 'Prueba', 2, current_date - 3, '19:00', '20:00' from mesas where nombre = 'Mesa 1';
  exception when others then rechazada := sqlerrm = 'FECHA_PASADA';
  end;
  if not rechazada then raise exception 'Se aceptó una reserva en fecha pasada'; end if;
end $$;

-- Sin contraseña no se pueden modificar mesas
do $$
declare n int;
begin
  update mesas set capacidad = 1 where nombre = 'Mesa 1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'El público pudo modificar una mesa'; end if;
end $$;

-- Con una contraseña incorrecta tampoco
select set_config('request.headers', '{"x-admin-clave":"incorrecta"}', false);
do $$ begin
  if public.verificar_admin() then raise exception 'Se aceptó una contraseña incorrecta'; end if;
end $$;

-- Con la contraseña correcta el administrador lee y modifica
select set_config('request.headers', '{"x-admin-clave":"clave-solo-para-ci"}', false);
do $$
declare n int;
begin
  if not public.verificar_admin() then raise exception 'Se rechazó la contraseña correcta'; end if;
  if (select count(*) from reservas) <> 1 then raise exception 'El administrador no puede leer las reservas'; end if;
  if (select count(*) from platos) <> 14 then raise exception 'El administrador no ve los platos ocultos'; end if;
  update mesas set activa = false where nombre = 'Mesa 1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El administrador no pudo modificar una mesa'; end if;
  update reservas set estado = 'cancelada' where cliente_nombre = 'Prueba CI';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El administrador no pudo cancelar una reserva'; end if;
end $$;

reset role;

-- Una reserva cancelada libera el horario
do $$ begin
  if (select count(*) from slots_ocupados) <> 0 then raise exception 'La reserva cancelada sigue ocupando el horario'; end if;
end $$;

select 'Todas las pruebas de base de datos pasaron' as resultado;
