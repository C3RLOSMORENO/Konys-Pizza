-- Reemplaza la carta y el horario de ejemplo por los datos reales de Konys (sede El Prado).
-- Solo para una base que ya tenía cargado esquema.sql. No toca mesas ni reservas.
-- Supabase → SQL Editor → pega este archivo → Run.

begin;

delete from public.platos;
delete from public.horarios;

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
  ('Coca-Cola 400 ml',       'bebidas',  'Gaseosa Coca-Cola Original.',                                      5000, true);

commit;
