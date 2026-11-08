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
select set_config('request.headers', '{}', false);
do $$ begin
  if public.iniciar_sesion('konys2026') is not null then raise exception 'Hay una clave de admin por defecto en el esquema'; end if;
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
do $$ begin
  if public.iniciar_sesion('incorrecta') is not null then raise exception 'Se aceptó una contraseña incorrecta'; end if;
end $$;

-- La contraseña ya no sirve como encabezado: solo un token de sesión
select set_config('request.headers', '{"x-admin-clave":"clave-solo-para-ci"}', false);
do $$ begin
  if public.verificar_admin() then raise exception 'Se aceptó la contraseña enviada como encabezado'; end if;
end $$;
select set_config('request.headers', '{"x-admin-token":"no-es-un-uuid"}', false);
do $$ begin
  if public.verificar_admin() then raise exception 'Se aceptó un token inventado'; end if;
end $$;

-- Con la contraseña correcta el administrador lee y modifica
-- Con la contraseña correcta se recibe un token que vence a los 10 minutos
select set_config('request.headers', json_build_object('x-admin-token', public.iniciar_sesion('clave-solo-para-ci') ->> 'token')::text, false);
do $$
declare n int;
begin
  if not public.verificar_admin() then raise exception 'Se rechazó la contraseña correcta'; end if;
  begin
    perform count(*) from sesiones_admin;
    raise exception 'Por la API se pueden leer los tokens de sesión';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from intentos_acceso;
    raise exception 'Por la API se pueden leer los intentos de acceso';
  exception when insufficient_privilege then null;
  end;
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

-- -----------------------------------------------------------------------------
-- Validación de datos (supabase/validaciones.sql): todo dato mal formado se rechaza
-- aunque llegue directo a la API, sin pasar por la página
-- -----------------------------------------------------------------------------
create function pg_temp.rechaza(consulta text, esperado text) returns void language plpgsql as $f$
begin
  begin
    execute consulta;
  exception when others then
    if sqlerrm like '%' || esperado || '%' then return; end if;
    raise exception 'Se esperaba «%» y la base respondió «%» en: %', esperado, sqlerrm, consulta;
  end;
  raise exception 'La base aceptó un dato inválido: %', consulta;
end $f$;

create function pg_temp.reserva(nombre text, contacto text, personas text, dias int, ini text, fin text) returns text
language sql as $f$
  select format('insert into reservas (mesa_id, cliente_nombre, cliente_contacto, num_personas, fecha, hora_inicio, hora_fin)
                 select id, %L, %L, %s, current_date + %s, %L, %L from mesas where nombre = ''Mesa 3''',
                nombre, contacto, personas, dias, ini, fin)
$f$;

-- Reservas: nombre, teléfono, personas, horas y fechas
select pg_temp.rechaza(pg_temp.reserva('Juan123', null, '2', 1, '18:00', '19:00'), 'reservas_nombre_valido');
select pg_temp.rechaza(pg_temp.reserva('<script>alert(1)</script>', null, '2', 1, '18:00', '19:00'), 'reservas_nombre_valido');
select pg_temp.rechaza(pg_temp.reserva('J', null, '2', 1, '18:00', '19:00'), 'nombre');
select pg_temp.rechaza(pg_temp.reserva('  Juan', null, '2', 1, '18:00', '19:00'), 'reservas_nombre_valido');
select pg_temp.rechaza(pg_temp.reserva('Juan', 'juan@correo', '2', 1, '18:00', '19:00'), 'reservas_contacto_valido');
select pg_temp.rechaza(pg_temp.reserva('Juan', '12345', '2', 1, '18:00', '19:00'), 'reservas_contacto_valido');
select pg_temp.rechaza(pg_temp.reserva('Juan', '3001234567', '2', 1, '18:00', '19:00'), 'reservas_contacto_valido');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '0', 1, '18:00', '19:00'), 'personas');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '31', 1, '18:00', '19:00'), 'CAPACIDAD_SUPERADA');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '''dos''', 1, '18:00', '19:00'), 'invalid input syntax');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '''2.5''', 1, '18:00', '19:00'), 'invalid input syntax');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '2', 1, '19:00', '18:00'), 'reservas_horas_validas');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '2', 1, '03:00', '04:00'), 'FUERA_DE_HORARIO');
select pg_temp.rechaza(pg_temp.reserva('Juan', null, '2', 60, '18:00', '19:00'), 'FECHA_FUERA_DE_RANGO');
-- Una reserva con datos correctos sí entra (tildes, apóstrofo y teléfono con formato)
do $$ begin
  execute pg_temp.reserva('María José O''Brien', '300 123 4567', '4', 1, '18:00', '19:00');
end $$;

-- Mesas
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad) values ('<b>Mesa</b>', 'salon', 4)$$, 'mesas_nombre_valido');
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad) values ('mesa 3', 'salon', 4)$$, 'mesas_nombre_unico');
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad) values ('Mesa 20', 'salon', 31)$$, 'check');
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad) values ('Mesa 20', 'cocina', 4)$$, 'check');
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad, foto_url) values ('Mesa 20', 'salon', 4, 'javascript:alert(1)')$$, 'mesas_foto_valida');
select pg_temp.rechaza($$insert into mesas (nombre, zona, capacidad, foto_url) values ('Mesa 20', 'salon', 4, 'http://sitio.com/a.jpg')$$, 'mesas_foto_valida');
insert into mesas (nombre, zona, capacidad, foto_url) values ('Mesa 20', 'salon', 4, 'https://xyz.supabase.co/storage/v1/object/public/fotos/mesa-20.jpg');

-- Platos
select pg_temp.rechaza($$insert into platos (nombre, categoria, precio) values ('Pizza <img>', 'pizzas', 30000)$$, 'platos_nombre_valido');
select pg_temp.rechaza($$insert into platos (nombre, categoria, precio) values ('PAN DE AJO', 'entradas', 3000)$$, 'platos_nombre_unico');
select pg_temp.rechaza($$insert into platos (nombre, categoria, precio) values ('Pizza nueva', 'pizzas', 50)$$, 'platos_precio_valido');
select pg_temp.rechaza($$insert into platos (nombre, categoria, precio) values ('Pizza nueva', 'pizzas', 99999999)$$, 'platos_precio_valido');
select pg_temp.rechaza($$insert into platos (nombre, categoria, descripcion, precio) values ('Pizza nueva', 'pizzas', '<script>x</script>', 30000)$$, 'platos_descripcion_valida');
select pg_temp.rechaza($$insert into platos (nombre, categoria, precio) values ('Pizza nueva', 'sopas', 30000)$$, 'check');

-- Horarios
select pg_temp.rechaza($$update horarios set duracion_slot = 17 where dia_semana = 'lunes' and jornada = 'noche'$$, 'horarios_duracion_valida');
select pg_temp.rechaza($$update horarios set duracion_slot = 240 where dia_semana = 'lunes' and jornada = 'almuerzo'$$, 'horarios_duracion_valida');
select pg_temp.rechaza($$update horarios set hora_fin = '10:00' where dia_semana = 'lunes' and jornada = 'almuerzo'$$, 'check');
select pg_temp.rechaza($$insert into horarios (dia_semana, jornada, hora_inicio, hora_fin) values ('feriado', 'noche', '18:00', '22:00')$$, 'check');

-- -----------------------------------------------------------------------------
-- Sesiones que vencen y bloqueo por fuerza bruta (supabase/seguridad.sql)
-- -----------------------------------------------------------------------------
do $$ begin
  if (select count(*) from sesiones_admin where expira > now() + interval '10 minutes' or expira < now() + interval '9 minutes') > 0 then
    raise exception 'La sesión no vence a los 10 minutos';
  end if;
end $$;

-- Una sesión vencida ya no sirve, aunque el navegador tenga el token
select set_config('request.headers', json_build_object('x-admin-token', (select token from sesiones_admin limit 1))::text, false);
update sesiones_admin set expira = now() - interval '1 second';
do $$ begin
  if public.verificar_admin() then raise exception 'Una sesión vencida sigue funcionando'; end if;
end $$;

-- Cerrar sesión invalida el token
set role anon;
select set_config('request.headers', json_build_object('x-admin-token', public.iniciar_sesion('clave-solo-para-ci') ->> 'token')::text, false);
do $$ begin
  if not public.verificar_admin() then raise exception 'El token nuevo no funciona'; end if;
  perform public.cerrar_sesion();
  if public.verificar_admin() then raise exception 'El token sigue sirviendo después de cerrar sesión'; end if;
end $$;

-- Cinco contraseñas incorrectas seguidas bloquean el acceso, incluso con la contraseña correcta
do $$
declare bloqueado boolean := false;
begin
  for i in 1..5 loop perform public.iniciar_sesion('mala-' || i); end loop;
  begin
    perform public.iniciar_sesion('clave-solo-para-ci');
  exception when others then bloqueado := sqlerrm = 'BLOQUEADO';
  end;
  if not bloqueado then raise exception 'No se bloqueó el acceso después de 5 intentos fallidos'; end if;
end $$;
reset role;

select 'Todas las pruebas de base de datos pasaron' as resultado;
