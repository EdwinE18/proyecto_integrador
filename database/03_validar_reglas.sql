-- =====================================================================
--  Validación automática de reglas de negocio (docs/REGLAS_DE_NEGOCIO.md)
--  Uso:  psql -h localhost -U pms_admin -d hotel_pms < database/03_validar_reglas.sql 2>&1 | sed 's/NOTICE:  //'
--  Requiere los datos de prueba (02_seed.sql). NO deja cambios: todo se
--  ejecuta dentro de una transacción que se deshace al final (ROLLBACK).
-- =====================================================================
\set QUIET on
\pset pager off
SET client_min_messages = notice;

BEGIN;

-- La instrucción DEBE fallar (la regla la bloquea)
CREATE FUNCTION pg_temp.debe_fallar(regla text, descripcion text, sentencia text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE sentencia;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✅ PASA   %  %', rpad(regla, 6), descripcion;
    RETURN;
  END;
  RAISE NOTICE '❌ FALLA  %  % (se permitió y no debía)', rpad(regla, 6), descripcion;
END $$ LANGUAGE plpgsql;

-- La instrucción DEBE funcionar (la regla la permite)
CREATE FUNCTION pg_temp.debe_pasar(regla text, descripcion text, sentencia text) RETURNS void AS $$
BEGIN
  EXECUTE sentencia;
  RAISE NOTICE '✅ PASA   %  %', rpad(regla, 6), descripcion;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ FALLA  %  % (error: %)', rpad(regla, 6), descripcion, SQLERRM;
END $$ LANGUAGE plpgsql;

-- La condición DEBE ser verdadera
CREATE FUNCTION pg_temp.debe_cumplir(regla text, descripcion text, condicion text) RETURNS void AS $$
DECLARE ok boolean;
BEGIN
  EXECUTE 'SELECT (' || condicion || ')' INTO ok;
  IF ok THEN RAISE NOTICE '✅ PASA   %  %', rpad(regla, 6), descripcion;
  ELSE RAISE NOTICE '❌ FALLA  %  %', rpad(regla, 6), descripcion; END IF;
END $$ LANGUAGE plpgsql;

-- Datos de apoyo: habitación 202 de Posada Los Arcos, fechas lejanas para no chocar con nada
CREATE TEMP TABLE ctx AS
SELECT h.id AS hab, h.hotel_id AS hotel,
       (SELECT id FROM habitaciones WHERE hotel_id = '22222222-2222-2222-2222-222222222222' LIMIT 1) AS hab_otro_hotel,
       'b0000000-0000-0000-0000-000000000001'::uuid AS ana,
       'b0000000-0000-0000-0000-000000000002'::uuid AS lucas
FROM habitaciones h
WHERE h.numero = '202' AND h.hotel_id = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE c ctx%ROWTYPE;
  ins text := 'INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida, num_adultos, precio_noche, total, estado) VALUES (%L, %L, %L, %L, %L, %s, 1000, 1000, %L)';
BEGIN
  SELECT * INTO c FROM ctx;
  RAISE NOTICE '';
  RAISE NOTICE '==== RESERVACIONES ====';

  -- Base: Ana reserva del 10 al 13 de enero de 2030
  PERFORM pg_temp.debe_pasar('base', 'Se crea una reservación válida (10–13 ene)',
    format(ins, c.hotel, c.ana, c.hab, '2030-01-10', '2030-01-13', 2, 'confirmada'));

  PERFORM pg_temp.debe_fallar('RN-01', 'No se puede reservar la misma habitación en fechas encimadas (11–14 ene)',
    format(ins, c.hotel, c.lucas, c.hab, '2030-01-11', '2030-01-14', 1, 'pendiente'));

  PERFORM pg_temp.debe_pasar('RN-02', 'Se puede entrar el mismo día que otro sale (13–14 ene)',
    format(ins, c.hotel, c.lucas, c.hab, '2030-01-13', '2030-01-14', 1, 'pendiente'));

  PERFORM pg_temp.debe_pasar('RN-03', 'Una reservación cancelada libera las fechas (se cancela la de Ana…)',
    'UPDATE reservaciones SET estado = ''cancelada'', motivo_cancelacion = ''Prueba RN-03'' WHERE fecha_entrada = ''2030-01-10''');
  PERFORM pg_temp.debe_pasar('RN-03', '…y otra persona puede tomar esas fechas (10–13 ene)',
    format(ins, c.hotel, c.lucas, c.hab, '2030-01-10', '2030-01-13', 1, 'confirmada'));

  PERFORM pg_temp.debe_fallar('RN-04', 'La salida no puede ser igual a la entrada',
    format(ins, c.hotel, c.ana, c.hab, '2030-02-01', '2030-02-01', 1, 'pendiente'));
  PERFORM pg_temp.debe_fallar('RN-04', 'La salida no puede ser antes de la entrada',
    format(ins, c.hotel, c.ana, c.hab, '2030-02-05', '2030-02-01', 1, 'pendiente'));

  PERFORM pg_temp.debe_fallar('RN-05', 'Debe haber al menos un adulto',
    format(ins, c.hotel, c.ana, c.hab, '2030-03-01', '2030-03-02', 0, 'pendiente'));

  PERFORM pg_temp.debe_cumplir('RN-06', 'Las noches se calculan solas (10–13 ene = 3 noches)',
    $q$(SELECT noches FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada') = 3$q$);

  PERFORM pg_temp.debe_cumplir('RN-07', 'Toda reservación tiene un código único',
    'NOT EXISTS (SELECT 1 FROM reservaciones WHERE codigo IS NULL) AND (SELECT count(*) = count(DISTINCT codigo) FROM reservaciones)');

  PERFORM pg_temp.debe_fallar('RN-08', 'No se puede usar una habitación de otro hotel',
    format(ins, c.hotel, c.ana, c.hab_otro_hotel, '2030-04-01', '2030-04-02', 1, 'pendiente'));

  -- RN-11, RN-12 y RN-13 requieren database/05_reglas_reservacion.sql
  PERFORM pg_temp.debe_fallar('RN-12', 'No se puede cancelar sin motivo',
    $q$UPDATE reservaciones SET estado = 'cancelada' WHERE fecha_entrada = '2030-01-13'$q$);
  PERFORM pg_temp.debe_fallar('RN-12', 'Un motivo de puros espacios no cuenta',
    $q$UPDATE reservaciones SET estado = 'cancelada', motivo_cancelacion = '      ' WHERE fecha_entrada = '2030-01-13'$q$);

  PERFORM pg_temp.debe_fallar('RN-11', 'No caben 3 adultos en una habitación doble',
    format(ins, c.hotel, c.ana, c.hab, '2030-05-01', '2030-05-03', 3, 'pendiente'));
  PERFORM pg_temp.debe_pasar('RN-11', 'Sí caben 2 adultos en una habitación doble',
    format(ins, c.hotel, c.ana, c.hab, '2030-05-01', '2030-05-03', 2, 'pendiente'));
  PERFORM pg_temp.debe_fallar('RN-11', 'No se puede subir a 3 adultos una reservación existente',
    $q$UPDATE reservaciones SET num_adultos = 3 WHERE fecha_entrada = '2030-05-01'$q$);

  PERFORM pg_temp.debe_pasar('RN-13', 'Se manda la habitación 202 a mantenimiento…',
    format('UPDATE habitaciones SET estado = ''mantenimiento'' WHERE id = %L', c.hab));
  PERFORM pg_temp.debe_fallar('RN-13', '…y ya no se puede reservar',
    format(ins, c.hotel, c.ana, c.hab, '2030-06-01', '2030-06-03', 1, 'pendiente'));
  PERFORM pg_temp.debe_pasar('RN-13', '…pero sus reservaciones previas se pueden seguir editando',
    $q$UPDATE reservaciones SET estado = 'cancelada', motivo_cancelacion = 'Cuarto en mantenimiento' WHERE fecha_entrada = '2030-05-01'$q$);
  PERFORM pg_temp.debe_pasar('RN-13', 'Se regresa la habitación a disponible',
    format('UPDATE habitaciones SET estado = ''disponible'' WHERE id = %L', c.hab));

  RAISE NOTICE '';
  RAISE NOTICE '==== HABITACIONES Y HUÉSPEDES ====';

  PERFORM pg_temp.debe_fallar('RN-20', 'No se repite el número de habitación en el mismo hotel',
    format('INSERT INTO habitaciones (hotel_id, tipo_id, numero) SELECT hotel_id, tipo_id, ''202'' FROM habitaciones WHERE id = %L', c.hab));

  PERFORM pg_temp.debe_pasar('RN-22', 'Se cambia el estado de una habitación…',
    format('UPDATE habitaciones SET estado = ''limpieza'' WHERE id = %L', c.hab));
  PERFORM pg_temp.debe_cumplir('RN-22', '…y el cambio queda en el historial automáticamente',
    format('EXISTS (SELECT 1 FROM historial_habitacion WHERE habitacion_id = %L AND estado_nuevo = ''limpieza'')', c.hab));

  PERFORM pg_temp.debe_fallar('RN-23', 'No se borra un huésped que tiene reservaciones',
    format('DELETE FROM huespedes WHERE id = %L', c.lucas));

  -- RN-32 y RN-33 requieren database/07_reglas_huespedes.sql
  PERFORM pg_temp.debe_fallar('RN-32', 'Un huésped necesita correo o teléfono',
    'INSERT INTO huespedes (nombre, apellidos) VALUES (''Sin'', ''Contacto'')');
  PERFORM pg_temp.debe_fallar('RN-32', 'Un correo vacío no cuenta como contacto',
    'INSERT INTO huespedes (nombre, apellidos, email) VALUES (''Sin'', ''Contacto'', ''   '')');
  PERFORM pg_temp.debe_pasar('RN-32', 'Con teléfono es suficiente',
    'INSERT INTO huespedes (nombre, apellidos, telefono) VALUES (''Con'', ''Telefono'', ''9611112233'')');
  PERFORM pg_temp.debe_fallar('RN-33', 'No se guarda un número de documento sin su tipo',
    'INSERT INTO huespedes (nombre, apellidos, telefono, num_documento) VALUES (''Doc'', ''Incompleto'', ''9611112233'', ''ABC123'')');

  PERFORM pg_temp.debe_fallar('RN-30', 'No se repite un documento de identidad',
    'INSERT INTO huespedes (nombre, apellidos, tipo_documento, num_documento) VALUES (''Otra'', ''Persona'', ''INE'', ''MADA900101MDF'')');

  RAISE NOTICE '';
  RAISE NOTICE '==== ESTANCIAS, PAGOS Y TARIFAS ====';

  PERFORM pg_temp.debe_fallar('RN-41', 'El check-out no puede ser antes del check-in',
    $q$INSERT INTO estancias (reservacion_id, check_in_real, check_out_real)
       SELECT id, '2030-01-10 15:00', '2030-01-09 12:00' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);

  PERFORM pg_temp.debe_fallar('RN-50', 'Un pago no puede ser de $0',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 0, 'efectivo' FROM reservaciones LIMIT 1$q$);

  -- RN-42 a RN-55 requieren database/06_reglas_estancias_pagos.sql
  -- Se usa la reservación de Lucas del 10 al 13 de enero (confirmada, total $1000)
  PERFORM pg_temp.debe_fallar('RN-54', 'No se puede cobrar más que el total ($1500 de $1000)',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 1500, 'efectivo' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);
  PERFORM pg_temp.debe_pasar('RN-54', 'Se registra un anticipo de $600',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo, es_anticipo) SELECT id, 600, 'efectivo', true FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);
  PERFORM pg_temp.debe_fallar('RN-54', 'Con $600 pagados, no se aceptan $500 más (sería $1100)',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 500, 'efectivo' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);

  PERFORM pg_temp.debe_fallar('RN-42', 'No se hace check-in de una reservación pendiente',
    $q$UPDATE reservaciones SET estado = 'check_in' WHERE fecha_entrada = '2030-01-13'$q$);
  PERFORM pg_temp.debe_fallar('RN-43', 'No se hace check-out sin haber hecho check-in',
    $q$UPDATE reservaciones SET estado = 'check_out' WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);
  PERFORM pg_temp.debe_pasar('RN-42', 'Sí se hace check-in de una reservación confirmada',
    $q$UPDATE reservaciones SET estado = 'check_in' WHERE fecha_entrada = '2030-01-10' AND estado = 'confirmada'$q$);
  PERFORM pg_temp.debe_fallar('RN-52', 'No se hace check-out debiendo $400',
    $q$UPDATE reservaciones SET estado = 'check_out' WHERE fecha_entrada = '2030-01-10' AND estado = 'check_in'$q$);
  PERFORM pg_temp.debe_pasar('RN-52', 'Se paga el resto ($400)…',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 400, 'tarjeta' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'check_in'$q$);
  PERFORM pg_temp.debe_pasar('RN-52', '…y ya se puede hacer check-out',
    $q$UPDATE reservaciones SET estado = 'check_out' WHERE fecha_entrada = '2030-01-10' AND estado = 'check_in'$q$);
  PERFORM pg_temp.debe_fallar('RN-55', 'No se cobra a una reservación que ya hizo check-out',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 1, 'efectivo' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'check_out'$q$);
  PERFORM pg_temp.debe_fallar('RN-55', 'No se cobra a una reservación cancelada',
    $q$INSERT INTO pagos (reservacion_id, monto, metodo) SELECT id, 1, 'efectivo' FROM reservaciones WHERE fecha_entrada = '2030-01-10' AND estado = 'cancelada'$q$);

  PERFORM pg_temp.debe_pasar('RN-60', 'Se crea la temporada Semana Santa (24–31 mar)…',
    $q$INSERT INTO tarifas_temporada (tipo_id, nombre, fecha_inicio, fecha_fin, precio_noche)
       VALUES ('a0000000-0000-0000-0000-000000000002', 'Semana Santa', '2030-03-24', '2030-03-31', 1500)$q$);
  PERFORM pg_temp.debe_fallar('RN-60', '…y no se puede crear otra temporada encimada (28 mar–5 abr)',
    $q$INSERT INTO tarifas_temporada (tipo_id, nombre, fecha_inicio, fecha_fin, precio_noche)
       VALUES ('a0000000-0000-0000-0000-000000000002', 'Pascua', '2030-03-28', '2030-04-05', 1300)$q$);

  RAISE NOTICE '';
  RAISE NOTICE '==== USUARIOS Y SEGURIDAD ====';
  -- RN-71 y RN-75 requieren database/08_reglas_usuarios.sql
  PERFORM pg_temp.debe_fallar('RN-70', 'No se repite el correo de un usuario (sin importar mayúsculas)',
    $q$INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES ('X', 'Y', 'ADMIN@PMS.LOCAL', crypt('Demo1234', gen_salt('bf')), 'admin')$q$);
  PERFORM pg_temp.debe_fallar('RN-71', 'No se guarda una contraseña en texto plano',
    $q$INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES ('X', 'Y', 'x@y.mx', 'Demo1234', 'admin')$q$);
  PERFORM pg_temp.debe_pasar('RN-71', 'Sí se guarda un hash bcrypt',
    $q$INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES ('X', 'Y', 'x@y.mx', crypt('Demo1234', gen_salt('bf', 10)), 'admin')$q$);
  PERFORM pg_temp.debe_fallar('RN-75', 'Un recepcionista debe pertenecer a un hotel',
    $q$INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES ('X', 'Y', 'r@y.mx', crypt('Demo1234', gen_salt('bf', 10)), 'recepcion')$q$);

  RAISE NOTICE '';
  RAISE NOTICE 'Listo. Todos los cambios de prueba se deshacen (ROLLBACK).';
END $$;

ROLLBACK;
