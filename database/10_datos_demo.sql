-- =====================================================================
--  DATOS DE DEMOSTRACIÓN (para la presentación y para 11_consultas_evaluacion.sql)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/10_datos_demo.sql
--
--  Las fechas son RELATIVAS A HOY (CURRENT_DATE ± días), así que el tablero
--  siempre muestra gente que llega, que sale y que está hospedada.
--  Respeta todas las reglas: los triggers de la BD revisan cada inserción.
--  Si ya se cargaron, no hace nada (se puede ejecutar varias veces).
-- =====================================================================
SET client_min_messages = notice;

DO $$
DECLARE
  D CONSTANT DATE := CURRENT_DATE;
  ARCOS CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
  CANON CONSTANT UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
  IF EXISTS (SELECT 1 FROM huespedes WHERE id = 'c0000000-0000-0000-0000-000000000001') THEN
    RAISE NOTICE 'Los datos de demostración ya estaban cargados.';
    RETURN;
  END IF;

  -- ------------------------- Huéspedes -------------------------
  INSERT INTO huespedes (id, nombre, apellidos, email, telefono, tipo_documento, num_documento, nacionalidad, ciudad_origen, fecha_nacimiento) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Sofía',   'Gutiérrez Ramos',  'sofia.gr@correo.mx',   '8112223344', 'INE',       'GURS920314MNL', 'Mexicana',    'Monterrey',  '1992-03-14'),
    ('c0000000-0000-0000-0000-000000000002', 'Diego',   'Hernández Sol',    NULL,                   '2229998877', 'INE',       'HESD880721HPL', 'Mexicana',    'Puebla',     '1988-07-21'),
    ('c0000000-0000-0000-0000-000000000003', 'Carla',   'Ortiz Velasco',    'carla.ov@mail.com',    NULL,         NULL,        NULL,            'Mexicana',    'Guadalajara','1995-11-02'),
    ('c0000000-0000-0000-0000-000000000004', 'Marta',   'Ruiz Domínguez',   'marta.rd@correo.mx',   '9611234567', 'INE',       'RUDM790105MCS', 'Mexicana',    'Tuxtla Gutiérrez', '1979-01-05'),
    ('c0000000-0000-0000-0000-000000000005', 'Jorge',   'Castillo Peña',    NULL,                   '5533221100', NULL,        NULL,            'Mexicana',    'CDMX',       '1990-06-30'),
    ('c0000000-0000-0000-0000-000000000006', 'Lucía',   'Mendoza Pérez',    'lucia.mp@correo.mx',   '9614445566', 'pasaporte', 'G12345678',     'Mexicana',    'Oaxaca',     '2000-09-18'),
    ('c0000000-0000-0000-0000-000000000007', 'Pierre',  'Dubois',           'pierre.d@mail.fr',     '+33612345678','pasaporte', '19FR45821',     'Francesa',    'Lyon',       '1985-04-12'),
    ('c0000000-0000-0000-0000-000000000008', 'Emma',    'Johnson',          'emma.j@mail.com',      NULL,         'pasaporte', 'US5501234',     'Estadounidense','Austin',   '1998-12-24');

  -- ------------------------- Reservaciones -------------------------
  -- (id, hotel, huésped, habitación, entrada, salida, adultos, niños, precio, estado inicial, canal)
  INSERT INTO reservaciones (id, hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida, num_adultos, num_ninos, precio_noche, total, estado, canal)
  SELECT v.id::uuid, v.hotel::uuid, v.huesped::uuid, h.id, D + v.ent, D + v.sal, v.ad, v.ni, t.precio_base, t.precio_base * (v.sal - v.ent), 'confirmada', v.canal::canal_reservacion
  FROM (VALUES
    ('d0000000-0000-0000-0000-000000000001', ARCOS, 'c0000000-0000-0000-0000-000000000001', '101', -20, -17, 1, 0, 'whatsapp'),
    ('d0000000-0000-0000-0000-000000000002', ARCOS, 'c0000000-0000-0000-0000-000000000002', '202', -15, -12, 2, 0, 'telefono'),
    ('d0000000-0000-0000-0000-000000000003', ARCOS, 'b0000000-0000-0000-0000-000000000002', '201', -10,  -8, 2, 0, 'web'),
    ('d0000000-0000-0000-0000-000000000004', ARCOS, 'c0000000-0000-0000-0000-000000000003', '102',  -6,  -4, 1, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000005', ARCOS, 'c0000000-0000-0000-0000-000000000004', '202',  -2,   0, 2, 1, 'mostrador'),   -- sale HOY debiendo $1,200
    ('d0000000-0000-0000-0000-000000000006', ARCOS, 'c0000000-0000-0000-0000-000000000005', '101',   0,   2, 1, 0, 'telefono'),
    ('d0000000-0000-0000-0000-000000000007', ARCOS, 'c0000000-0000-0000-0000-000000000006', '102',   5,   9, 1, 0, 'whatsapp'),
    ('d0000000-0000-0000-0000-000000000008', ARCOS, 'c0000000-0000-0000-0000-000000000007', '202',  10,  12, 2, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000009', CANON, 'c0000000-0000-0000-0000-000000000007', '10',   -9,  -6, 2, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000010', CANON, 'c0000000-0000-0000-0000-000000000006', 'S1',   -1,   2, 2, 2, 'web'),
    ('d0000000-0000-0000-0000-000000000011', CANON, 'c0000000-0000-0000-0000-000000000001', '11',    3,   6, 2, 1, 'telegram'),
    ('d0000000-0000-0000-0000-000000000012', CANON, 'c0000000-0000-0000-0000-000000000008', '10',  -30, -28, 1, 0, 'ota')
  ) AS v(id, hotel, huesped, numero, ent, sal, ad, ni, canal)
  JOIN habitaciones h ON h.hotel_id = v.hotel::uuid AND h.numero = v.numero
  JOIN tipos_habitacion t ON t.id = h.tipo_id;

  -- Pendiente de confirmar (llega hoy) y cancelada / no llegó
  UPDATE reservaciones SET estado = 'pendiente' WHERE id = 'd0000000-0000-0000-0000-000000000006';
  UPDATE reservaciones SET estado = 'cancelada', motivo_cancelacion = 'Cambió de destino por trabajo'
   WHERE id = 'd0000000-0000-0000-0000-000000000004';
  UPDATE reservaciones SET estado = 'no_show' WHERE id = 'd0000000-0000-0000-0000-000000000012';

  -- Check-in de las estancias pasadas y de las actuales (RN-42: desde confirmada)
  UPDATE reservaciones SET estado = 'check_in'
   WHERE id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003',
                'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000010');
  INSERT INTO estancias (reservacion_id, check_in_real, placas_vehiculo)
  SELECT r.id, (r.fecha_entrada + TIME '15:30') AT TIME ZONE 'America/Mexico_City',
         CASE r.id WHEN 'd0000000-0000-0000-0000-000000000002' THEN 'PUE4821' WHEN 'd0000000-0000-0000-0000-000000000005' THEN 'DBC1234' END
  FROM reservaciones r WHERE r.estado = 'check_in' AND r.id::text LIKE 'd0000000%';

  -- Pagos (RN-54: nunca más que el total)
  INSERT INTO pagos (reservacion_id, monto, metodo, referencia, es_anticipo, fecha_pago)
  SELECT v.r::uuid, v.monto, v.metodo::metodo_pago, v.ref, v.anticipo, now() - make_interval(days => v.hace)
  FROM (VALUES
    ('d0000000-0000-0000-0000-000000000001',  650.00, 'transferencia', 'SPEI 4471', true,  25),
    ('d0000000-0000-0000-0000-000000000001', 1300.00, 'tarjeta',       NULL,        false, 17),
    ('d0000000-0000-0000-0000-000000000002', 3300.00, 'efectivo',      NULL,        false, 12),
    ('d0000000-0000-0000-0000-000000000003', 1000.00, 'deposito',      'OXXO 99812', true, 14),
    ('d0000000-0000-0000-0000-000000000003', 1200.00, 'efectivo',      NULL,        false,  8),
    ('d0000000-0000-0000-0000-000000000005', 1000.00, 'efectivo',      NULL,        true,   2),
    ('d0000000-0000-0000-0000-000000000007',  780.00, 'transferencia', 'SPEI 5530', true,   1),
    ('d0000000-0000-0000-0000-000000000009', 4200.00, 'tarjeta',       NULL,        false,  6),
    ('d0000000-0000-0000-0000-000000000010', 7800.00, 'tarjeta',       NULL,        false,  1),
    ('d0000000-0000-0000-0000-000000000011', 2100.00, 'transferencia', 'SPEI 6610', true,   0)
  ) AS v(r, monto, metodo, ref, anticipo, hace);

  -- Check-out de las estancias pasadas (RN-52: ya están pagadas)
  UPDATE reservaciones SET estado = 'check_out'
   WHERE id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
                'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000009');
  UPDATE estancias e SET check_out_real = (r.fecha_salida + TIME '11:45') AT TIME ZONE 'America/Mexico_City'
  FROM reservaciones r WHERE r.id = e.reservacion_id AND r.estado = 'check_out';

  -- Habitaciones ocupadas hoy y una por limpiar
  UPDATE habitaciones SET estado = 'ocupada'  WHERE (hotel_id, numero) IN ((ARCOS, '202'), (CANON, 'S1'));
  UPDATE habitaciones SET estado = 'limpieza' WHERE (hotel_id, numero) IN ((CANON, '10'));

  RAISE NOTICE 'Datos de demostración cargados: 8 huéspedes, 12 reservaciones, 10 pagos.';
END $$;
