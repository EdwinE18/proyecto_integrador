-- =====================================================================
--  MIGRACIÓN: dejar solo "Posada Los Arcos" y ampliarla a 12 habitaciones
--     psql -h localhost -U pms_admin -d hotel_pms -f database/13_un_solo_hotel.sql
--     psql -h localhost -U pms_admin -d hotel_pms -f database/10_datos_demo.sql
--
--  Solo hace falta en una base que ya tenía los datos de prueba anteriores
--  (con el Hotel Boutique Cañón). Una instalación nueva ya nace así (02_seed.sql).
--  Se puede ejecutar varias veces. Todo o nada: si algo falla, no cambia nada.
--  El sistema sigue admitiendo varios hoteles; solo cambian los datos.
-- =====================================================================
SET client_min_messages = notice;
BEGIN;

DO $$
DECLARE
  ARCOS CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
  CANON CONSTANT UUID := '22222222-2222-2222-2222-222222222222';
  n INT;
BEGIN
  IF EXISTS (SELECT 1 FROM hoteles WHERE id = CANON) THEN
    -- 1. Reservaciones del hotel que se quita (con sus pagos, estancias y eventos)
    DELETE FROM eventos_dominio WHERE agregado_id IN (SELECT id FROM reservaciones WHERE hotel_id = CANON);
    DELETE FROM pagos           WHERE reservacion_id IN (SELECT id FROM reservaciones WHERE hotel_id = CANON);
    DELETE FROM reservaciones   WHERE hotel_id = CANON;          -- las estancias se borran en cascada
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'Reservaciones del Hotel Boutique Cañón borradas: %', n;

    -- 2. Su personal pasa a la posada (el gerente demo cambia de correo)
    UPDATE usuarios SET email = 'gerente@losarcos.mx'
     WHERE email = 'gerente@boutiquecanon.mx'
       AND NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'gerente@losarcos.mx');
    UPDATE usuarios SET hotel_id = ARCOS WHERE hotel_id = CANON;

    -- 3. Cuartos, tipos (con sus temporadas) y el hotel
    DELETE FROM habitaciones     WHERE hotel_id = CANON;
    DELETE FROM tipos_habitacion WHERE hotel_id = CANON;
    DELETE FROM hoteles          WHERE id = CANON;
    RAISE NOTICE 'Hotel Boutique Cañón eliminado.';
  END IF;

  -- 4. Posada Los Arcos: datos, tipos nuevos y 12 habitaciones
  UPDATE hoteles SET direccion = COALESCE(direccion, 'Calle Real de Guadalupe 34, Barrio de Guadalupe') WHERE id = ARCOS;

  INSERT INTO tipos_habitacion (id, hotel_id, nombre, capacidad_adultos, capacidad_ninos, precio_base, amenidades) VALUES
    ('a0000000-0000-0000-0000-000000000003', ARCOS, 'Familiar',     4, 2, 1600, '["wifi","chimenea","dos camas matrimoniales"]'),
    ('a0000000-0000-0000-0000-000000000004', ARCOS, 'Suite jardín', 2, 2, 2200, '["wifi","chimenea","terraza","tina"]')
  ON CONFLICT DO NOTHING;

  INSERT INTO habitaciones (hotel_id, tipo_id, numero, piso)
  SELECT ARCOS, v.tipo::uuid, v.numero, v.piso
  FROM (VALUES
    ('a0000000-0000-0000-0000-000000000001', '101', 1), ('a0000000-0000-0000-0000-000000000001', '102', 1),
    ('a0000000-0000-0000-0000-000000000001', '103', 1), ('a0000000-0000-0000-0000-000000000002', '104', 1),
    ('a0000000-0000-0000-0000-000000000002', '105', 1),
    ('a0000000-0000-0000-0000-000000000002', '201', 2), ('a0000000-0000-0000-0000-000000000002', '202', 2),
    ('a0000000-0000-0000-0000-000000000002', '203', 2), ('a0000000-0000-0000-0000-000000000003', '204', 2),
    ('a0000000-0000-0000-0000-000000000003', '205', 2),
    ('a0000000-0000-0000-0000-000000000004', '301', 3), ('a0000000-0000-0000-0000-000000000004', '302', 3)
  ) AS v(tipo, numero, piso)
  ON CONFLICT (hotel_id, numero) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Habitaciones nuevas en Posada Los Arcos: % (total: %)', n,
    (SELECT COUNT(*) FROM habitaciones WHERE hotel_id = ARCOS);

  -- 5. Temporada navideña para los tipos nuevos (si no tienen ya una en esas fechas, RN-60)
  INSERT INTO tarifas_temporada (tipo_id, nombre, fecha_inicio, fecha_fin, precio_noche)
  SELECT v.tipo::uuid, 'Navidad y Año Nuevo 2026', DATE '2026-12-20', DATE '2027-01-03', v.precio
  FROM (VALUES ('a0000000-0000-0000-0000-000000000003', 2200), ('a0000000-0000-0000-0000-000000000004', 3000)) AS v(tipo, precio)
  WHERE NOT EXISTS (SELECT 1 FROM tarifas_temporada t WHERE t.tipo_id = v.tipo::uuid
                    AND daterange(t.fecha_inicio, t.fecha_fin, '[)') && daterange(DATE '2026-12-20', DATE '2027-01-03', '[)'));
END $$;

COMMIT;
\echo '✅ Listo. Ahora ejecuta 10_datos_demo.sql para recrear la demostración con la fecha de hoy.'
