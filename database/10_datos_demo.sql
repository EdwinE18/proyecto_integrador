-- =====================================================================
--  DATOS DE DEMOSTRACIÓN (para la presentación y para 11_consultas_evaluacion.sql)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/10_datos_demo.sql
--
--  Las fechas son RELATIVAS AL DÍA EN QUE SE EJECUTA (CURRENT_DATE ± días).
--  👉 Ejecútalo EL MISMO DÍA de la presentación: si ya estaban cargados de
--     otro día, los borra y los vuelve a crear con la fecha de hoy.
--  Solo toca los datos de demostración (ids que empiezan con c000… y d000…);
--  tus otras reservaciones y huéspedes no se modifican.
--  Respeta todas las reglas: los triggers de la BD revisan cada inserción.
-- =====================================================================
SET client_min_messages = notice;

DO $$
DECLARE
  D CONSTANT DATE := CURRENT_DATE;
  ARCOS CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- ---------- Si ya existían (de otro día), se borran para recrearlos con la fecha de hoy ----------
  IF EXISTS (SELECT 1 FROM huespedes WHERE id = 'c0000000-0000-0000-0000-000000000001') THEN
    DELETE FROM notificaciones  WHERE evento_id IN (SELECT id FROM eventos_dominio WHERE agregado_id::text LIKE 'd0000000%');
    DELETE FROM eventos_dominio WHERE agregado_id::text LIKE 'd0000000%';
    DELETE FROM pagos           WHERE reservacion_id::text LIKE 'd0000000%';
    DELETE FROM estancias       WHERE reservacion_id::text LIKE 'd0000000%';
    DELETE FROM reservaciones   WHERE id::text LIKE 'd0000000%';
    DELETE FROM huespedes h     WHERE h.id::text LIKE 'c0000000%'
                                  AND NOT EXISTS (SELECT 1 FROM reservaciones r WHERE r.huesped_id = h.id);
    RAISE NOTICE 'Se borraron los datos de demostración anteriores; se vuelven a crear con la fecha de hoy.';
  END IF;

  -- Los cuartos que usa la demostración deben estar en servicio para poder reservarlos (RN-13).
  -- Los que tienen un huésped real hospedado hoy no se tocan.
  UPDATE habitaciones h SET estado = 'disponible'
   WHERE h.hotel_id = ARCOS
     AND NOT EXISTS (SELECT 1 FROM reservaciones r
                     WHERE r.habitacion_id = h.id AND r.estado = 'check_in' AND r.id::text NOT LIKE 'd0000000%');

  -- Si alguna reservación tuya de prueba ocupa los mismos cuartos y fechas que la demostración,
  -- la regla anti-sobreventa (RN-01) no dejaría crear la demo: esas se cancelan con motivo.
  UPDATE reservaciones r
     SET estado = 'cancelada', motivo_cancelacion = 'Liberada para los datos de demostración'
   WHERE r.estado IN ('pendiente', 'confirmada')
     AND r.id::text NOT LIKE 'd0000000%'
     AND r.hotel_id = ARCOS
     AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(D - 31, D + 13, '[)');

  -- ------------------------- Huéspedes -------------------------
  INSERT INTO huespedes (id, nombre, apellidos, email, telefono, tipo_documento, num_documento, nacionalidad, ciudad_origen, fecha_nacimiento) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Sofía',   'Gutiérrez Ramos',  'sofia.gr@correo.mx',   '8112223344', 'INE',       'GURS920314MNL', 'Mexicana',    'Monterrey',  '1992-03-14'),
    ('c0000000-0000-0000-0000-000000000002', 'Diego',   'Hernández Sol',    NULL,                   '2229998877', 'INE',       'HESD880721HPL', 'Mexicana',    'Puebla',     '1988-07-21'),
    ('c0000000-0000-0000-0000-000000000003', 'Carla',   'Ortiz Velasco',    'carla.ov@mail.com',    NULL,         NULL,        NULL,            'Mexicana',    'Guadalajara','1995-11-02'),
    ('c0000000-0000-0000-0000-000000000004', 'Marta',   'Ruiz Domínguez',   'marta.rd@correo.mx',   '9611234567', 'INE',       'RUDM790105MCS', 'Mexicana',    'Tuxtla Gutiérrez', '1979-01-05'),
    ('c0000000-0000-0000-0000-000000000005', 'Jorge',   'Castillo Peña',    NULL,                   '5533221100', NULL,        NULL,            'Mexicana',    'CDMX',       '1990-06-30'),
    ('c0000000-0000-0000-0000-000000000006', 'Lucía',   'Mendoza Pérez',    'lucia.mp@correo.mx',   '9614445566', 'pasaporte', 'G12345678',     'Mexicana',    'Oaxaca',     '2000-09-18'),
    ('c0000000-0000-0000-0000-000000000007', 'Pierre',  'Dubois',           'pierre.d@mail.fr',     '+33612345678','pasaporte', '19FR45821',     'Francesa',    'Lyon',       '1985-04-12'),
    ('c0000000-0000-0000-0000-000000000008', 'Emma',    'Johnson',          'emma.j@mail.com',      NULL,         'pasaporte', 'US5501234',     'Estadounidense','Austin',   '1998-12-24')
  ON CONFLICT (id) DO NOTHING;

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
    ('d0000000-0000-0000-0000-000000000009', ARCOS, 'c0000000-0000-0000-0000-000000000007', '301',  -9,  -6, 2, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000010', ARCOS, 'c0000000-0000-0000-0000-000000000006', '302',  -1,   2, 2, 2, 'web'),        -- hospedada hoy
    ('d0000000-0000-0000-0000-000000000011', ARCOS, 'c0000000-0000-0000-0000-000000000001', '204',   3,   6, 3, 1, 'telegram'),
    ('d0000000-0000-0000-0000-000000000012', ARCOS, 'c0000000-0000-0000-0000-000000000008', '103', -30, -28, 1, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000014', ARCOS, 'c0000000-0000-0000-0000-000000000002', '205',  -2,   1, 4, 2, 'whatsapp'),   -- familia hospedada
    ('d0000000-0000-0000-0000-000000000015', ARCOS, 'c0000000-0000-0000-0000-000000000003', '104',   0,   3, 2, 0, 'web'),        -- llega hoy, confirmada
    ('d0000000-0000-0000-0000-000000000016', ARCOS, 'c0000000-0000-0000-0000-000000000008', '203',  -3,   0, 2, 0, 'ota'),        -- salió hoy temprano
    ('d0000000-0000-0000-0000-000000000017', ARCOS, 'c0000000-0000-0000-0000-000000000007', '105',   1,   4, 2, 0, 'telefono'),   -- llega mañana
    ('d0000000-0000-0000-0000-000000000018', ARCOS, 'c0000000-0000-0000-0000-000000000005', '301',  -25, -22, 2, 0, 'ota'),
    ('d0000000-0000-0000-0000-000000000019', ARCOS, 'c0000000-0000-0000-0000-000000000004', '205',  -14, -11, 3, 2, 'whatsapp'),
    ('d0000000-0000-0000-0000-000000000013', ARCOS, 'b0000000-0000-0000-0000-000000000002', '201',  -1,   2, 2, 0, 'telefono')   -- hospedado hoy
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
                'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000010',
                'd0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000016',
                'd0000000-0000-0000-0000-000000000018', 'd0000000-0000-0000-0000-000000000019');
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
    ('d0000000-0000-0000-0000-000000000009', 6600.00, 'tarjeta',       NULL,        false,  6),
    ('d0000000-0000-0000-0000-000000000010', 6600.00, 'tarjeta',       NULL,        false,  1),
    ('d0000000-0000-0000-0000-000000000011', 2400.00, 'transferencia', 'SPEI 6610', true,   0),
    ('d0000000-0000-0000-0000-000000000013', 1100.00, 'efectivo',      NULL,        true,   1),
    ('d0000000-0000-0000-0000-000000000014', 2400.00, 'efectivo',      NULL,        true,   2),
    ('d0000000-0000-0000-0000-000000000015', 1100.00, 'transferencia', 'SPEI 7120', true,   3),
    ('d0000000-0000-0000-0000-000000000016', 3300.00, 'tarjeta',       NULL,        false,  0),
    ('d0000000-0000-0000-0000-000000000018', 2200.00, 'deposito',      'OXXO 10233', true, 30),
    ('d0000000-0000-0000-0000-000000000018', 4400.00, 'tarjeta',       NULL,        false, 22),
    ('d0000000-0000-0000-0000-000000000019', 4800.00, 'efectivo',      NULL,        false, 11)
  ) AS v(r, monto, metodo, ref, anticipo, hace);

  -- Check-out de las estancias pasadas (RN-52: ya están pagadas)
  UPDATE reservaciones SET estado = 'check_out'
   WHERE id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
                'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000009',
                'd0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000018',
                'd0000000-0000-0000-0000-000000000019');
  UPDATE estancias e SET check_out_real = (r.fecha_salida + TIME '11:45') AT TIME ZONE 'America/Mexico_City'
  FROM reservaciones r WHERE r.id = e.reservacion_id AND r.estado = 'check_out';

  -- Habitaciones ocupadas hoy y una por limpiar
  UPDATE habitaciones SET estado = 'ocupada'  WHERE hotel_id = ARCOS AND numero IN ('201', '202', '205', '302');
  UPDATE habitaciones SET estado = 'limpieza' WHERE hotel_id = ARCOS AND numero IN ('203');
  UPDATE habitaciones SET estado = 'mantenimiento', notas = 'Fuga en la regadera' WHERE hotel_id = ARCOS AND numero = '103';

  RAISE NOTICE 'Datos de demostración cargados con fecha de hoy (%): 8 huéspedes, 19 reservaciones, 18 pagos (Posada Los Arcos, 12 habitaciones).', TO_CHAR(D, 'DD/MM/YYYY');
END $$;
