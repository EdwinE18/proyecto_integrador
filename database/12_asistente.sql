-- =====================================================================
--  ASISTENTE DEL PERSONAL (bot de Telegram con IA en n8n)  — RN-86 a RN-89
--     psql -h localhost -U pms_admin -d hotel_pms -f database/12_asistente.sql
--  Se puede ejecutar varias veces.
--
--  Idea (para gastar pocos tokens y no arriesgar datos):
--   · La IA NO escribe SQL. Solo puede llamar estas funciones ("herramientas").
--   · Cada función recibe el chat de Telegram de quien pregunta y AQUÍ se
--     decide qué puede ver según su rol y su hotel (RN-72, RN-75). El chat lo
--     pone n8n, no la IA, así que la IA no puede hacerse pasar por otro usuario.
--   · Cada función regresa un TEXTO CORTO ya resumido (no tablas enteras).
--   · n8n se conecta con el usuario "asistente_ro", que solo puede ejecutar
--     estas funciones: no puede leer ni cambiar ninguna tabla directamente.
-- =====================================================================
SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS asistente;

-- Texto de contexto para la IA (lo llena scripts/esquema_compacto.py)
CREATE TABLE IF NOT EXISTS asistente.contexto (
  clave       TEXT PRIMARY KEY,
  texto       TEXT NOT NULL,
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- RN-86: ¿quién pregunta y qué puede ver?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asistente._quien(p_chat TEXT, p_solo_admin BOOLEAN DEFAULT FALSE,
  OUT ok BOOLEAN, OUT mensaje TEXT, OUT nombre TEXT, OUT rol TEXT, OUT hotel_id UUID)
AS $$
DECLARE u RECORD;
BEGIN
  SELECT us.nombre, us.rol::text AS rol, us.hotel_id INTO u
  FROM usuarios us WHERE us.telegram_chat_id = p_chat AND us.activo;
  IF NOT FOUND THEN
    ok := FALSE; mensaje := '⛔ Este chat no está registrado como personal del hotel.'; RETURN;
  END IF;
  nombre := u.nombre; rol := u.rol; hotel_id := u.hotel_id;
  IF u.rol = 'limpieza' THEN
    ok := FALSE; mensaje := '⛔ El asistente es para reservaciones y administración.'; RETURN;
  END IF;
  IF p_solo_admin AND u.rol NOT IN ('admin', 'gerente') THEN
    ok := FALSE; mensaje := '⛔ Esa información (ingresos y estadísticas) es solo para administración y gerencia.'; RETURN;
  END IF;
  ok := TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Hoteles que puede consultar: el suyo, o todos si es admin general (opcionalmente filtrados por nombre)
CREATE OR REPLACE FUNCTION asistente._hoteles(p_hotel_usuario UUID, p_filtro TEXT)
RETURNS SETOF hoteles AS $$
  SELECT * FROM hoteles h
  WHERE h.activo
    AND (p_hotel_usuario IS NULL OR h.id = p_hotel_usuario)          -- RN-75: su hotel (o todos si es admin general)
    AND (NULLIF(TRIM(p_filtro), '') IS NULL                           -- y, si pidió uno, el que coincida
         OR LOWER(TRANSLATE(h.nombre, 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn')) LIKE '%' || LOWER(TRANSLATE(TRIM(p_filtro), 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn')) || '%')
  ORDER BY h.nombre;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- n8n la llama ANTES de la IA: valida al usuario y entrega el contexto.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asistente.identificar(p_chat TEXT)
RETURNS TABLE (autorizado BOOLEAN, mensaje TEXT, nombre TEXT, rol TEXT, hotel TEXT, hoy TEXT, esquema TEXT) AS $$
DECLARE q RECORD;
BEGIN
  q := asistente._quien(p_chat);
  autorizado := q.ok;
  IF NOT q.ok THEN
    mensaje := CONCAT(q.mensaje, E'\n', 'Tu número de chat es ', p_chat,
                      '. Pídele al administrador que lo registre en tu usuario.');
  END IF;
  nombre := q.nombre; rol := q.rol;
  hotel := COALESCE((SELECT h.nombre FROM hoteles h WHERE h.id = q.hotel_id), 'todos los hoteles');
  hoy := CONCAT((ARRAY['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[EXTRACT(DOW FROM CURRENT_DATE)::int + 1],
                ' ', TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY'), ' (', TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), ')');
  esquema := (SELECT c.texto FROM asistente.contexto c WHERE c.clave = 'esquema');
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- HERRAMIENTAS PARA RESERVACIONES (recepción, gerente y admin)
-- ---------------------------------------------------------------------

-- Resumen del día: llegadas, salidas, ocupación, cuartos por limpiar
CREATE OR REPLACE FUNCTION asistente.resumen_dia(p_chat TEXT, p_hotel TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE q RECORD; v TEXT;
BEGIN
  q := asistente._quien(p_chat); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  SELECT STRING_AGG(fn_resumen_diario(h.id), E'\n\n') INTO v FROM asistente._hoteles(q.hotel_id, p_hotel) h;
  RETURN COALESCE(v, 'No encontré ese hotel.');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Cuartos libres con el precio total calculado noche por noche (RN-01, RN-11, RN-13, RN-61)
CREATE OR REPLACE FUNCTION asistente.disponibilidad(p_chat TEXT, p_entrada DATE, p_salida DATE,
  p_adultos INT DEFAULT 1, p_ninos INT DEFAULT 0, p_hotel TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE q RECORD; v TEXT;
BEGIN
  q := asistente._quien(p_chat); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  IF p_entrada IS NULL OR p_salida IS NULL OR p_salida <= p_entrada THEN
    RETURN 'Fechas inválidas: la salida debe ser posterior a la entrada (RN-04).'; END IF;
  IF p_entrada < CURRENT_DATE THEN RETURN 'No se puede reservar en fechas pasadas (RN-14).'; END IF;
  IF p_salida - p_entrada > 30 THEN RETURN 'Consulta como máximo 30 noches.'; END IF;

  SELECT STRING_AGG(CONCAT('• ', ho.nombre, ' · Hab. ', h.numero, ' (', t.nombre, ', hasta ', t.capacidad_adultos, ' adultos) → ',
                           fn_pesos(pr.total), ' en total',
                           CASE WHEN pr.con_temporada THEN ' (incluye tarifa de temporada)' ELSE '' END),
                    E'\n' ORDER BY ho.nombre, pr.total, h.numero) INTO v
  FROM asistente._hoteles(q.hotel_id, p_hotel) ho
  JOIN habitaciones h ON h.hotel_id = ho.id
  JOIN tipos_habitacion t ON t.id = h.tipo_id
  CROSS JOIN LATERAL (
    SELECT SUM(COALESCE(tt.precio_noche, t.precio_base)) AS total, BOOL_OR(tt.id IS NOT NULL) AS con_temporada
    FROM generate_series(p_entrada, p_salida - 1, interval '1 day') AS noche
    LEFT JOIN tarifas_temporada tt ON tt.tipo_id = t.id AND noche::date >= tt.fecha_inicio AND noche::date < tt.fecha_fin
  ) pr
  WHERE h.activo AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
    AND t.capacidad_adultos >= COALESCE(p_adultos, 1) AND t.capacidad_ninos >= COALESCE(p_ninos, 0)
    AND NOT EXISTS (SELECT 1 FROM reservaciones r
                    WHERE r.habitacion_id = h.id AND r.estado IN ('pendiente', 'confirmada', 'check_in')
                      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_entrada, p_salida, '[)'));

  RETURN CONCAT('Del ', fn_fecha(p_entrada), ' al ', fn_fecha(p_salida), ' (', p_salida - p_entrada, ' noches), ',
                p_adultos, ' adulto(s)', CASE WHEN p_ninos > 0 THEN CONCAT(' y ', p_ninos, ' niño(s)') ELSE '' END, ':', E'\n',
                COALESCE(v, 'No hay habitaciones libres con esas condiciones.'),
                E'\n', '(Para reservar usa el sistema web.)');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Detalle de una reservación por código, con saldo y pagos
CREATE OR REPLACE FUNCTION asistente.reservacion(p_chat TEXT, p_codigo TEXT)
RETURNS TEXT AS $$
DECLARE q RECORD; r RECORD; v_pagos TEXT;
BEGIN
  q := asistente._quien(p_chat); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  SELECT res.*, CONCAT(hu.nombre, ' ', hu.apellidos) AS huesped, hu.telefono, hab.numero, ho.nombre AS hotel,
         s.pagado, s.saldo, e.placas_vehiculo
    INTO r
  FROM reservaciones res
  JOIN huespedes hu ON hu.id = res.huesped_id
  JOIN habitaciones hab ON hab.id = res.habitacion_id
  JOIN hoteles ho ON ho.id = res.hotel_id
  JOIN v_saldo_reservaciones s ON s.id = res.id
  LEFT JOIN estancias e ON e.reservacion_id = res.id
  WHERE res.codigo = UPPER(REGEXP_REPLACE(COALESCE(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
    AND res.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, NULL) h);
  IF NOT FOUND THEN RETURN CONCAT('No encontré la reservación ', UPPER(p_codigo), ' en tu hotel.'); END IF;

  SELECT STRING_AGG(CONCAT('  - ', fn_fecha(p.fecha_pago::date), ' ', fn_pesos(p.monto), ' ', p.metodo,
                           CASE WHEN p.es_anticipo THEN ' (anticipo)' ELSE '' END), E'\n' ORDER BY p.fecha_pago) INTO v_pagos
  FROM pagos p WHERE p.reservacion_id = r.id;

  RETURN CONCAT('Reservación ', r.codigo, ' · ', r.hotel, E'\n',
    'Huésped: ', r.huesped, COALESCE(' · tel. ' || r.telefono, ''), E'\n',
    'Hab. ', r.numero, ' · ', fn_fecha(r.fecha_entrada), ' → ', fn_fecha(r.fecha_salida), ' (', r.noches, ' noches) · ',
    r.num_adultos, ' adulto(s)', CASE WHEN r.num_ninos > 0 THEN CONCAT(', ', r.num_ninos, ' niño(s)') ELSE '' END, E'\n',
    'Estado: ', r.estado, CASE WHEN r.motivo_cancelacion IS NOT NULL THEN CONCAT(' (motivo: ', r.motivo_cancelacion, ')') ELSE '' END,
    ' · canal: ', r.canal, E'\n',
    'Total ', fn_pesos(r.total), ' · pagado ', fn_pesos(r.pagado), ' · saldo ', fn_pesos(r.saldo),
    COALESCE(E'\nPagos:\n' || v_pagos, ''),
    COALESCE(E'\nPlacas: ' || r.placas_vehiculo, ''));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Buscar huésped por nombre, teléfono o correo (máximo 5) y sus reservaciones en el hotel
CREATE OR REPLACE FUNCTION asistente.buscar_huesped(p_chat TEXT, p_texto TEXT)
RETURNS TEXT AS $$
DECLARE q RECORD; v TEXT; v_q TEXT := TRIM(COALESCE(p_texto, '')); v_dig TEXT;
BEGIN
  q := asistente._quien(p_chat); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  IF LENGTH(v_q) < 2 THEN RETURN 'Escribe al menos 2 letras para buscar.'; END IF;
  v_dig := REGEXP_REPLACE(v_q, '\D', '', 'g');

  SELECT STRING_AGG(linea, E'\n') INTO v FROM (
    SELECT CONCAT('• ', hu.nombre, ' ', hu.apellidos,
                  COALESCE(' · tel. ' || hu.telefono, ''), COALESCE(' · ' || hu.email, ''),
                  COALESCE(E'\n    Reservaciones: ' || (
                    SELECT STRING_AGG(CONCAT(r.codigo, ' (', r.estado, ', ', fn_fecha(r.fecha_entrada), ')'), ', ' ORDER BY r.fecha_entrada DESC)
                    FROM reservaciones r
                    WHERE r.huesped_id = hu.id AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, NULL) h)), '')) AS linea
    FROM huespedes hu
    WHERE CONCAT(hu.nombre, ' ', hu.apellidos) ILIKE '%' || v_q || '%'
       OR LOWER(TRANSLATE(CONCAT(hu.nombre, ' ', hu.apellidos), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) LIKE '%' || LOWER(TRANSLATE(v_q, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) || '%'
       OR hu.email ILIKE '%' || v_q || '%'
       OR (LENGTH(v_dig) >= 4 AND hu.telefono LIKE '%' || v_dig || '%')
    ORDER BY hu.apellidos LIMIT 5) t;
  RETURN COALESCE(v, CONCAT('No encontré huéspedes con "', v_q, '".'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Pendientes: sin confirmar, saldos por cobrar de huéspedes en casa, cuartos fuera de servicio
CREATE OR REPLACE FUNCTION asistente.pendientes(p_chat TEXT, p_hotel TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE q RECORD; v1 TEXT; v2 TEXT; v3 TEXT;
BEGIN
  q := asistente._quien(p_chat); IF NOT q.ok THEN RETURN q.mensaje; END IF;

  SELECT STRING_AGG(CONCAT('  • ', r.codigo, ' · ', hu.nombre, ' ', hu.apellidos, ' · llega ', fn_fecha(r.fecha_entrada),
                           ' · hab. ', hab.numero), E'\n' ORDER BY r.fecha_entrada) INTO v1
  FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id JOIN habitaciones hab ON hab.id = r.habitacion_id
  WHERE r.estado = 'pendiente' AND r.fecha_entrada >= CURRENT_DATE
    AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, p_hotel) h);

  SELECT STRING_AGG(CONCAT('  • ', r.codigo, ' · ', hu.nombre, ' ', hu.apellidos, ' · hab. ', hab.numero,
                           ' · debe ', fn_pesos(s.saldo), ' · sale ', fn_fecha(r.fecha_salida)), E'\n' ORDER BY r.fecha_salida) INTO v2
  FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id JOIN habitaciones hab ON hab.id = r.habitacion_id
  JOIN v_saldo_reservaciones s ON s.id = r.id
  WHERE r.estado = 'check_in' AND s.saldo > 0
    AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, p_hotel) h);

  SELECT STRING_AGG(CONCAT('  • ', ho.nombre, ' hab. ', hab.numero, ': ', REPLACE(hab.estado::text, '_', ' ')), E'\n') INTO v3
  FROM habitaciones hab JOIN asistente._hoteles(q.hotel_id, p_hotel) ho ON ho.id = hab.hotel_id
  WHERE hab.estado IN ('limpieza', 'mantenimiento', 'fuera_servicio');

  RETURN CONCAT('⏳ Sin confirmar:', E'\n', COALESCE(v1, '  Ninguna'), E'\n\n',
                '💵 Hospedados con saldo:', E'\n', COALESCE(v2, '  Ninguno'), E'\n\n',
                '🧹 Cuartos no disponibles:', E'\n', COALESCE(v3, '  Ninguno'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- HERRAMIENTAS SOLO PARA ADMINISTRACIÓN (admin y gerente)  — RN-87
-- ---------------------------------------------------------------------

-- Ingresos cobrados en un periodo: total, por método y por hotel
CREATE OR REPLACE FUNCTION asistente.ingresos(p_chat TEXT, p_desde DATE, p_hasta DATE, p_hotel TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE q RECORD; v_total NUMERIC; v_n INT; v_metodos TEXT; v_hoteles TEXT; v_por_cobrar NUMERIC;
BEGIN
  q := asistente._quien(p_chat, TRUE); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN RETURN 'Indica un periodo válido (desde ≤ hasta).'; END IF;

  SELECT COALESCE(SUM(p.monto), 0), COUNT(*) INTO v_total, v_n
  FROM pagos p JOIN reservaciones r ON r.id = p.reservacion_id
  WHERE p.fecha_pago::date BETWEEN p_desde AND p_hasta
    AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, p_hotel) h);

  SELECT STRING_AGG(CONCAT('  • ', metodo, ': ', fn_pesos(t), ' (', ROUND(100.0 * t / NULLIF(v_total, 0)), '%)'), E'\n' ORDER BY t DESC) INTO v_metodos
  FROM (SELECT p.metodo::text AS metodo, SUM(p.monto) AS t
        FROM pagos p JOIN reservaciones r ON r.id = p.reservacion_id
        WHERE p.fecha_pago::date BETWEEN p_desde AND p_hasta
          AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, p_hotel) h)
        GROUP BY p.metodo) m;

  SELECT STRING_AGG(CONCAT('  • ', ho.nombre, ': ', fn_pesos(COALESCE(x.t, 0))), E'\n' ORDER BY ho.nombre) INTO v_hoteles
  FROM asistente._hoteles(q.hotel_id, p_hotel) ho
  LEFT JOIN (SELECT r.hotel_id, SUM(p.monto) AS t FROM pagos p JOIN reservaciones r ON r.id = p.reservacion_id
             WHERE p.fecha_pago::date BETWEEN p_desde AND p_hasta GROUP BY r.hotel_id) x ON x.hotel_id = ho.id;

  SELECT COALESCE(SUM(s.saldo), 0) INTO v_por_cobrar
  FROM v_saldo_reservaciones s JOIN reservaciones r ON r.id = s.id
  WHERE r.estado IN ('confirmada', 'check_in') AND s.saldo > 0
    AND r.hotel_id IN (SELECT h.id FROM asistente._hoteles(q.hotel_id, p_hotel) h);

  RETURN CONCAT('💰 Cobrado del ', fn_fecha(p_desde), ' al ', fn_fecha(p_hasta), ': ', fn_pesos(v_total), ' en ', v_n, ' pago(s)',
                CASE WHEN v_n > 0 THEN CONCAT(' · promedio ', fn_pesos(ROUND(v_total / v_n, 2))) ELSE '' END, E'\n',
                'Por método:', E'\n', COALESCE(v_metodos, '  —'), E'\n',
                'Por hotel:', E'\n', COALESCE(v_hoteles, '  —'), E'\n',
                'Por cobrar hoy (reservaciones activas con saldo): ', fn_pesos(v_por_cobrar));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Indicadores hoteleros de un periodo: ocupación, tarifa promedio (ADR), RevPAR, canales y cancelaciones
CREATE OR REPLACE FUNCTION asistente.estadisticas(p_chat TEXT, p_desde DATE, p_hasta DATE, p_hotel TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE q RECORD; v_dias INT; v_cuartos INT; v_noches NUMERIC; v_ingreso NUMERIC; v_canales TEXT; v_estados TEXT; v_motivos TEXT;
BEGIN
  q := asistente._quien(p_chat, TRUE); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN RETURN 'Indica un periodo válido (desde ≤ hasta).'; END IF;
  v_dias := p_hasta - p_desde + 1;

  SELECT COUNT(*) INTO v_cuartos FROM habitaciones h
  WHERE h.activo AND h.hotel_id IN (SELECT x.id FROM asistente._hoteles(q.hotel_id, p_hotel) x);

  -- Noches vendidas DENTRO del periodo (se recorta cada estancia al periodo) e ingreso de esas noches
  SELECT COALESCE(SUM(n), 0), COALESCE(SUM(n * r.precio_noche), 0) INTO v_noches, v_ingreso
  FROM reservaciones r
  CROSS JOIN LATERAL (SELECT GREATEST(LEAST(r.fecha_salida, p_hasta + 1) - GREATEST(r.fecha_entrada, p_desde), 0) AS n) c
  WHERE r.estado IN ('confirmada', 'check_in', 'check_out')
    AND r.hotel_id IN (SELECT x.id FROM asistente._hoteles(q.hotel_id, p_hotel) x);

  SELECT STRING_AGG(CONCAT(canal, ' ', c), ', ' ORDER BY c DESC) INTO v_canales
  FROM (SELECT r.canal::text AS canal, COUNT(*) AS c FROM reservaciones r
        WHERE r.created_at::date BETWEEN p_desde AND p_hasta
          AND r.hotel_id IN (SELECT x.id FROM asistente._hoteles(q.hotel_id, p_hotel) x)
        GROUP BY r.canal) t;

  SELECT STRING_AGG(CONCAT(estado, ' ', c), ', ' ORDER BY c DESC) INTO v_estados
  FROM (SELECT r.estado::text AS estado, COUNT(*) AS c FROM reservaciones r
        WHERE daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_desde, p_hasta + 1, '[)')
          AND r.hotel_id IN (SELECT x.id FROM asistente._hoteles(q.hotel_id, p_hotel) x)
        GROUP BY r.estado) t;

  SELECT STRING_AGG(DISTINCT r.motivo_cancelacion, '; ') INTO v_motivos
  FROM reservaciones r
  WHERE r.estado = 'cancelada' AND r.updated_at::date BETWEEN p_desde AND p_hasta
    AND r.hotel_id IN (SELECT x.id FROM asistente._hoteles(q.hotel_id, p_hotel) x);

  RETURN CONCAT('📊 Del ', fn_fecha(p_desde), ' al ', fn_fecha(p_hasta), ' (', v_dias, ' días, ', v_cuartos, ' habitaciones)', E'\n',
    '• Ocupación: ', COALESCE(ROUND(100.0 * v_noches / NULLIF(v_cuartos * v_dias, 0), 1), 0), '% (', v_noches, ' de ', v_cuartos * v_dias, ' noches)', E'\n',
    '• Tarifa promedio por noche vendida (ADR): ', fn_pesos(ROUND(v_ingreso / NULLIF(v_noches, 0), 2)), E'\n',
    '• Ingreso por habitación disponible (RevPAR): ', fn_pesos(ROUND(v_ingreso / NULLIF(v_cuartos * v_dias, 0), 2)), E'\n',
    '• Reservaciones por estado: ', COALESCE(v_estados, '—'), E'\n',
    '• Nuevas reservaciones por canal: ', COALESCE(v_canales, '—'), E'\n',
    '• Motivos de cancelación: ', COALESCE(v_motivos, 'ninguno'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Avisos de Telegram que fallaron (para revisar la automatización)
CREATE OR REPLACE FUNCTION asistente.avisos_fallidos(p_chat TEXT)
RETURNS TEXT AS $$
DECLARE q RECORD; v TEXT;
BEGIN
  q := asistente._quien(p_chat, TRUE); IF NOT q.ok THEN RETURN q.mensaje; END IF;
  SELECT STRING_AGG(CONCAT('• ', TO_CHAR(n.created_at, 'DD/MM HH24:MI'), ' → ', LEFT(SPLIT_PART(n.mensaje, E'\n', 1), 50),
                           COALESCE(' · ' || n.error, '')), E'\n' ORDER BY n.created_at DESC) INTO v
  FROM (SELECT * FROM notificaciones WHERE estado = 'fallida' ORDER BY created_at DESC LIMIT 10) n;
  RETURN COALESCE(v, '✅ No hay avisos fallidos.');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- RN-88: n8n entra con un usuario que SOLO puede ejecutar estas funciones
-- (crearlo requiere superusuario: lo hace setup_db.sh, o ver automation/README.md)
-- ---------------------------------------------------------------------
REVOKE ALL ON SCHEMA asistente FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA asistente FROM PUBLIC;
REVOKE ALL ON asistente.contexto FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistente_ro') THEN
    GRANT USAGE ON SCHEMA asistente TO asistente_ro;
    GRANT EXECUTE ON FUNCTION
      asistente.identificar(TEXT),
      asistente.resumen_dia(TEXT, TEXT),
      asistente.disponibilidad(TEXT, DATE, DATE, INT, INT, TEXT),
      asistente.reservacion(TEXT, TEXT),
      asistente.buscar_huesped(TEXT, TEXT),
      asistente.pendientes(TEXT, TEXT),
      asistente.ingresos(TEXT, DATE, DATE, TEXT),
      asistente.estadisticas(TEXT, DATE, DATE, TEXT),
      asistente.avisos_fallidos(TEXT)
    TO asistente_ro;
    RAISE NOTICE 'Permisos del usuario asistente_ro actualizados.';
  ELSE
    RAISE NOTICE 'Falta crear el usuario de n8n. Ejecuta:  sudo -u postgres psql -c "CREATE ROLE asistente_ro LOGIN PASSWORD ''Asistente123''"  y vuelve a correr este archivo.';
  END IF;
END $$;
