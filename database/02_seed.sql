-- =====================================================================
--  Datos de prueba  (psql -U pms_admin -d hotel_pms -f 02_seed.sql)
--  Contraseña de todos los usuarios demo: Demo1234
-- =====================================================================
BEGIN;

INSERT INTO hoteles (id, nombre, tipo, ciudad, telefono, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Posada Los Arcos',      'posada',   'San Cristóbal de las Casas', '9671234567', 'contacto@losarcos.mx'),
  ('22222222-2222-2222-2222-222222222222', 'Hotel Boutique Cañón', 'boutique', 'Tuxtla Gutiérrez',           '9619876543', 'reservas@boutiquecanon.mx');

INSERT INTO usuarios (hotel_id, nombre, apellidos, email, password_hash, rol) VALUES
  (NULL, 'Admin', 'Sistema', 'admin@pms.local', crypt('Demo1234', gen_salt('bf', 10)), 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'María', 'López Pérez', 'recepcion@losarcos.mx', crypt('Demo1234', gen_salt('bf', 10)), 'recepcion'),
  ('22222222-2222-2222-2222-222222222222', 'Jorge', 'Ruiz Gómez',  'gerente@boutiquecanon.mx', crypt('Demo1234', gen_salt('bf', 10)), 'gerente');

INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad_adultos, capacidad_ninos, precio_base, amenidades) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sencilla',       1, 0,  650, '["wifi","agua caliente"]'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Doble chimenea', 2, 1, 1100, '["wifi","chimenea"]'),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Estándar',       2, 1, 1400, '["wifi","aire acondicionado","tv"]'),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Suite',          2, 2, 2600, '["wifi","aire acondicionado","jacuzzi"]');

INSERT INTO habitaciones (hotel_id, tipo_id, numero, piso) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '101', 1),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '102', 1),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '201', 2),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '202', 2),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', '10',  1),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', '11',  1),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000004', 'S1',  2);

INSERT INTO huespedes (id, nombre, apellidos, email, telefono, tipo_documento, num_documento, ciudad_origen) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Ana',    'Martínez Díaz', 'ana@correo.com',    '5512345678', 'INE',       'MADA900101MDF', 'CDMX'),
  ('b0000000-0000-0000-0000-000000000002', 'Lucas',  'Schneider',     'lucas@mail.de',     NULL,         'pasaporte', 'C01X00T47',     'Berlín');

-- Reservación de ejemplo: habitación 201, 3 noches
INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida, num_adultos, precio_noche, total, estado, canal)
SELECT '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', h.id,
       CURRENT_DATE, CURRENT_DATE + 3, 2, 1100, 3300, 'confirmada', 'telegram'
FROM habitaciones h WHERE h.numero = '201' AND h.hotel_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
