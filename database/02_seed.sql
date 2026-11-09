-- =====================================================================
--  Datos de prueba  (psql -U pms_admin -d hotel_pms -f 02_seed.sql)
--  Contraseña de todos los usuarios demo: Demo1234
-- =====================================================================
BEGIN;

-- Una posada familiar de San Cristóbal con 12 habitaciones en 3 pisos.
-- (El sistema admite varios hoteles; para la demostración se usa uno.)
INSERT INTO hoteles (id, nombre, tipo, ciudad, direccion, telefono, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Posada Los Arcos', 'posada', 'San Cristóbal de las Casas',
   'Calle Real de Guadalupe 34, Barrio de Guadalupe', '9671234567', 'contacto@losarcos.mx');

INSERT INTO usuarios (hotel_id, nombre, apellidos, email, password_hash, rol) VALUES
  (NULL, 'Admin', 'Sistema', 'admin@pms.local', crypt('Demo1234', gen_salt('bf', 10)), 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'Jorge', 'Ruiz Gómez',     'gerente@losarcos.mx',   crypt('Demo1234', gen_salt('bf', 10)), 'gerente'),
  ('11111111-1111-1111-1111-111111111111', 'María', 'López Pérez',    'recepcion@losarcos.mx', crypt('Demo1234', gen_salt('bf', 10)), 'recepcion'),
  ('11111111-1111-1111-1111-111111111111', 'Rosa',  'Hernández Cruz', 'limpieza@losarcos.mx',  crypt('Demo1234', gen_salt('bf', 10)), 'limpieza');

INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad_adultos, capacidad_ninos, precio_base, amenidades) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sencilla',       1, 0,  650, '["wifi","agua caliente"]'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Doble chimenea', 2, 1, 1100, '["wifi","chimenea"]'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Familiar',       4, 2, 1600, '["wifi","chimenea","dos camas matrimoniales"]'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Suite jardín',   2, 2, 2200, '["wifi","chimenea","terraza","tina"]');

-- Piso 1: sencillas y dobles · Piso 2: dobles y familiares · Piso 3: suites con terraza
INSERT INTO habitaciones (hotel_id, tipo_id, numero, piso)
SELECT '11111111-1111-1111-1111-111111111111', v.tipo::uuid, v.numero, v.piso
FROM (VALUES
  ('a0000000-0000-0000-0000-000000000001', '101', 1), ('a0000000-0000-0000-0000-000000000001', '102', 1),
  ('a0000000-0000-0000-0000-000000000001', '103', 1), ('a0000000-0000-0000-0000-000000000002', '104', 1),
  ('a0000000-0000-0000-0000-000000000002', '105', 1),
  ('a0000000-0000-0000-0000-000000000002', '201', 2), ('a0000000-0000-0000-0000-000000000002', '202', 2),
  ('a0000000-0000-0000-0000-000000000002', '203', 2), ('a0000000-0000-0000-0000-000000000003', '204', 2),
  ('a0000000-0000-0000-0000-000000000003', '205', 2),
  ('a0000000-0000-0000-0000-000000000004', '301', 3), ('a0000000-0000-0000-0000-000000000004', '302', 3)
) AS v(tipo, numero, piso);

INSERT INTO huespedes (id, nombre, apellidos, email, telefono, tipo_documento, num_documento, ciudad_origen) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Ana',    'Martínez Díaz', 'ana@correo.com',    '5512345678', 'INE',       'MADA900101MDF', 'CDMX'),
  ('b0000000-0000-0000-0000-000000000002', 'Lucas',  'Schneider',     'lucas@mail.de',     NULL,         'pasaporte', 'C01X00T47',     'Berlín');

-- Temporadas (RN-61): fecha_fin NO incluida
INSERT INTO tarifas_temporada (tipo_id, nombre, fecha_inicio, fecha_fin, precio_noche) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'Navidad y Año Nuevo 2026', '2026-12-20', '2027-01-03', 1500),
  ('a0000000-0000-0000-0000-000000000003', 'Navidad y Año Nuevo 2026', '2026-12-20', '2027-01-03', 2200),
  ('a0000000-0000-0000-0000-000000000004', 'Navidad y Año Nuevo 2026', '2026-12-20', '2027-01-03', 3000),
  ('a0000000-0000-0000-0000-000000000002', 'Semana Santa 2027',       '2027-03-21', '2027-04-04', 1400);

-- Reservación de ejemplo: habitación 201, 3 noches
INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida, num_adultos, precio_noche, total, estado, canal)
SELECT '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', h.id,
       CURRENT_DATE, CURRENT_DATE + 3, 2, 1100, 3300, 'confirmada', 'telegram'
FROM habitaciones h WHERE h.numero = '201' AND h.hotel_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
