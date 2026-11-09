-- =====================================================================
--  NOTIFICACIONES POR TELEGRAM (RN-80, RN-81, RN-82, RN-84, RN-85)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/09_notificaciones.sql
--  Se puede ejecutar varias veces sin problema.
--
--  Idea: PostgreSQL arma los mensajes (con funciones de cadena: CONCAT,
--  STRING_AGG, TO_CHAR, REGEXP_REPLACE). n8n y Node-RED solo los toman y
--  los envían. Así la lógica queda en un solo lugar y se puede probar con SQL.
--
--    backend ──► eventos_dominio ──► fn_tomar_notificaciones() ──► n8n ──► Telegram
--                                    fn_registrar_envio()      ◄── n8n
--    Telegram ──► Node-RED ──► fn_bot_responder()  (vincular huésped, /estado, /miid)
--    Node-RED (8:00) ──► fn_resumen_diario()   ──► Telegram de recepción
-- =====================================================================
SET client_min_messages = warning;

-- Para que dos ejecuciones de n8n al mismo tiempo no envíen el mismo mensaje dos veces
ALTER TABLE eventos_dominio ADD COLUMN IF NOT EXISTS tomado_en TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- Ayudantes de formato
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pesos(n NUMERIC) RETURNS TEXT AS $$
  SELECT CONCAT('$', TO_CHAR(COALESCE(n, 0), 'FM999,999,990.00'));
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_fecha(d DATE) RETURNS TEXT AS $$
  SELECT TO_CHAR(d, 'DD/MM/YYYY');
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- RN-81 y RN-84: arma el mensaje de un evento y decide a quién va (huésped o recepción).
-- Regresa (chat_id, mensaje). Si no hay a quién enviarlo, chat_id es NULL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_armar_notificacion(ev eventos_dominio, OUT chat_id TEXT, OUT mensaje TEXT) AS $$
DECLARE
  r RECORD;
BEGIN
  IF ev.tipo LIKE 'habitacion.%' THEN
    -- Aviso al chat de recepción cuando un cuarto sale de servicio
    SELECT ho.telegram_chat_id AS chat, hab.numero INTO r
    FROM habitaciones hab JOIN hoteles ho ON ho.id = hab.hotel_id WHERE hab.id = ev.agregado_id;
    IF ev.payload->>'a' IN ('mantenimiento', 'fuera_servicio') THEN
      chat_id := r.chat;
      mensaje := CONCAT('🔧 La habitación ', r.numero, ' pasó a ', REPLACE(ev.payload->>'a', '_', ' '),
                        CASE WHEN (ev.payload->>'reservacionesAfectadas')::int > 0
                             THEN CONCAT(E'.\n⚠️ Hay ', ev.payload->>'reservacionesAfectadas', ' reservación(es) que reubicar.')
                             ELSE '.' END);
    END IF;
    RETURN;
  END IF;

  SELECT res.codigo, res.estado, res.motivo_cancelacion, res.fecha_entrada, res.fecha_salida,
         hu.telegram_chat_id AS chat_huesped, INITCAP(hu.nombre) AS nombre,
         hab.numero, ho.nombre AS hotel, ho.telegram_chat_id AS chat_hotel,
         TO_CHAR(ho.hora_check_out, 'HH24:MI') AS hora_salida,
         s.total, s.pagado, s.saldo,
         m.mensaje AS resumen
    INTO r
  FROM reservaciones res
  JOIN huespedes hu ON hu.id = res.huesped_id
  JOIN habitaciones hab ON hab.id = res.habitacion_id
  JOIN hoteles ho ON ho.id = res.hotel_id
  JOIN v_saldo_reservaciones s ON s.id = res.id
  JOIN v_mensajes_reservacion m ON m.id = res.id
  WHERE res.id = ev.agregado_id;

  IF NOT FOUND THEN RETURN; END IF;

  CASE ev.tipo
    WHEN 'reservacion.creada', 'reservacion.confirmada' THEN
      chat_id := r.chat_huesped;
      mensaje := r.resumen;                                    -- vista de 04_funciones_cadena.sql
    WHEN 'reservacion.cancelada' THEN
      chat_id := r.chat_huesped;
      mensaje := CONCAT('❌ ', r.hotel, E'\n', 'Hola ', r.nombre, ', tu reservación ', r.codigo,
                        ' del ', fn_fecha(r.fecha_entrada), ' fue cancelada.', E'\n',
                        'Motivo: ', r.motivo_cancelacion, E'\n', 'Si tienes dudas, responde este mensaje o llámanos.');
    WHEN 'pago.registrado' THEN
      chat_id := r.chat_huesped;
      mensaje := CONCAT('💵 ', r.hotel, E'\n', 'Recibimos tu pago de ', fn_pesos((ev.payload->>'monto')::numeric),
                        ' para la reservación ', r.codigo, '.', E'\n',
                        CASE WHEN r.saldo > 0 THEN CONCAT('Saldo pendiente: ', fn_pesos(r.saldo))
                             ELSE '✅ Tu cuenta está liquidada. ¡Gracias!' END);
    WHEN 'estancia.check_in' THEN
      chat_id := r.chat_huesped;
      mensaje := CONCAT('🌿 ¡Bienvenido a ', r.hotel, ', ', r.nombre, '!', E'\n',
                        'Tu habitación es la ', r.numero, '. Tu salida es el ', fn_fecha(r.fecha_salida),
                        ' a las ', r.hora_salida, ' hrs.', E'\n',
                        'Escríbenos por aquí si necesitas algo.');
    WHEN 'reservacion.por_bot' THEN                            -- RN-93: aviso a recepción
      chat_id := r.chat_hotel;
      mensaje := CONCAT('📲 Nueva reservación por Telegram', E'\n',
                        r.codigo, ' · ', r.nombre, ' · hab. ', r.numero, E'\n',
                        fn_fecha(r.fecha_entrada), ' al ', fn_fecha(r.fecha_salida), ' · total ', fn_pesos(r.total), E'\n',
                        'Queda pendiente hasta que se pague el anticipo.');
    WHEN 'pago.por_bot' THEN
      chat_id := r.chat_hotel;
      mensaje := CONCAT('💳 Pago simulado por Telegram: ', fn_pesos((ev.payload->>'monto')::numeric),
                        ' · ', r.codigo, ' (', r.nombre, ')', E'\n',
                        'Referencia ', ev.payload->>'referencia', ' · saldo ', fn_pesos(r.saldo));
    WHEN 'estancia.check_out' THEN
      chat_id := r.chat_hotel;                                 -- RN-43: aviso a limpieza
      mensaje := CONCAT('🧹 La habitación ', r.numero, ' quedó libre y está lista para limpiar.', E'\n',
                        'Huésped: ', r.nombre, ' · ', r.codigo);
    ELSE
      NULL;   -- evento sin notificación
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------
-- RN-85: n8n llama a esta función cada minuto.
-- Toma hasta p_limite eventos pendientes y regresa los mensajes a enviar.
-- Los eventos que no tienen a quién enviarse se marcan como procesados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tomar_notificaciones(p_limite INT DEFAULT 20)
RETURNS TABLE (evento_id BIGINT, tipo TEXT, chat_id TEXT, mensaje TEXT) AS $$
DECLARE
  ev eventos_dominio;
  n  RECORD;
BEGIN
  FOR ev IN
    SELECT * FROM eventos_dominio e
    WHERE NOT e.procesado
      AND e.intentos < 5
      AND (e.tomado_en IS NULL OR e.tomado_en < now() - interval '5 minutes')   -- si n8n se cayó a medias, se reintenta
    ORDER BY e.id
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED                                                       -- dos n8n a la vez no toman el mismo
  LOOP
    n := fn_armar_notificacion(ev);
    IF n.chat_id IS NULL OR n.mensaje IS NULL THEN
      UPDATE eventos_dominio SET procesado = TRUE, procesado_en = now() WHERE id = ev.id;
      CONTINUE;
    END IF;
    UPDATE eventos_dominio SET tomado_en = now(), intentos = intentos + 1 WHERE id = ev.id;
    INSERT INTO notificaciones (destinatario, mensaje, evento_id) VALUES (n.chat_id, n.mensaje, ev.id);
    evento_id := ev.id; tipo := ev.tipo; chat_id := n.chat_id; mensaje := n.mensaje;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- RN-85: n8n avisa si Telegram aceptó o no el mensaje.
-- Si falla, se reintenta hasta 5 veces; después se marca como fallido.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_envio(p_evento BIGINT, p_ok BOOLEAN, p_error TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_intentos SMALLINT;
BEGIN
  UPDATE notificaciones
     SET estado = CASE WHEN p_ok THEN 'enviada' ELSE 'fallida' END::estado_notificacion,
         enviada_en = CASE WHEN p_ok THEN now() END,
         error = LEFT(p_error, 500)
   WHERE id = (SELECT id FROM notificaciones WHERE evento_id = p_evento ORDER BY created_at DESC LIMIT 1);

  UPDATE eventos_dominio
     SET procesado    = p_ok OR intentos >= 5,
         procesado_en = CASE WHEN p_ok OR intentos >= 5 THEN now() END,
         tomado_en    = NULL
   WHERE id = p_evento
  RETURNING intentos INTO v_intentos;

  RETURN CASE WHEN p_ok THEN 'enviada'
              WHEN v_intentos >= 5 THEN 'fallida definitivamente'
              ELSE 'se reintentará' END;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- RN-81: el bot (Node-RED) llama a esta función con cada mensaje que recibe.
-- Comandos:
--   /start ABC12345  o  ABC12345   → vincula el chat con el huésped de esa reservación
--   /estado                         → muestra sus reservaciones activas
--   /miid                           → muestra el número de chat (para configurar recepción)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bot_codigo(p_texto TEXT, p_chat TEXT, p_nombre TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_texto  TEXT := TRIM(COALESCE(p_texto, ''));
  v_codigo TEXT;
  r        RECORD;
  v_lista  TEXT;
BEGIN
  IF v_texto ILIKE '/miid%' THEN
    RETURN CONCAT('El número de este chat es: ', p_chat, E'\n',
                  'Para recibir aquí los avisos de recepción, pídele al administrador que lo registre en el hotel.');
  END IF;

  IF v_texto ILIKE '/estado%' THEN
    SELECT STRING_AGG(m.mensaje, E'\n\n' ORDER BY res.fecha_entrada) INTO v_lista
    FROM reservaciones res
    JOIN huespedes hu ON hu.id = res.huesped_id
    JOIN v_mensajes_reservacion m ON m.id = res.id
    WHERE hu.telegram_chat_id = p_chat AND res.estado IN ('pendiente', 'confirmada', 'check_in');
    RETURN COALESCE(v_lista, 'No tienes reservaciones activas vinculadas a este chat. Envíame tu código de reservación (8 letras y números).');
  END IF;

  -- "/start ABC12345", "abc12345" o "mi código es abc1-2345" → "ABC12345"
  -- Los códigos siempre son 8 caracteres hexadecimales (0-9, A-F): ver DEFAULT de reservaciones.codigo
  v_codigo := UPPER(REGEXP_REPLACE(REGEXP_REPLACE(v_texto, '^/start\s*', '', 'i'), '[^A-Za-z0-9]', '', 'g'));

  IF v_codigo !~ '^[0-9A-F]{8}$' THEN
    IF v_codigo ~ '[0-9]' THEN   -- intentó escribir un código, pero no tiene la forma correcta
      RETURN 'Ese código no parece válido. Debe tener 8 letras y números, por ejemplo: 3C8007D9. También puedes escribir /estado.';
    END IF;
    RETURN CONCAT('¡Hola', COALESCE(', ' || INITCAP(p_nombre), ''), '! 👋', E'\n',
                  'Soy el asistente del hotel. Envíame el código de tu reservación (8 letras y números) ',
                  'para recibir aquí tu confirmación y avisos.', E'\n', 'Escribe /estado para ver tus reservaciones.');
  END IF;

  SELECT res.id, res.huesped_id, INITCAP(hu.nombre) AS nombre, m.mensaje INTO r
  FROM reservaciones res
  JOIN huespedes hu ON hu.id = res.huesped_id
  JOIN v_mensajes_reservacion m ON m.id = res.id
  WHERE res.codigo = v_codigo AND res.estado IN ('pendiente', 'confirmada', 'check_in');

  IF NOT FOUND THEN
    RETURN CONCAT('No encontré una reservación activa con el código ', v_codigo, '. Revisa que esté bien escrito.');
  END IF;

  UPDATE huespedes SET telegram_chat_id = p_chat WHERE id = r.huesped_id;
  RETURN CONCAT('¡Listo, ', r.nombre, '! ✅ Desde ahora recibirás aquí los avisos de tu reservación.', E'\n\n', r.mensaje);
END;
$$ LANGUAGE plpgsql;

-- Node-RED siempre llama a esta función. Si está instalado el bot de reservaciones
-- (14_bot_huespedes.sql), la conversación completa la lleva fn_bot_conversar();
-- si no, solo se vinculan códigos, /estado y /miid.
CREATE OR REPLACE FUNCTION fn_bot_responder(p_texto TEXT, p_chat TEXT, p_nombre TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE v TEXT;
BEGIN
  IF to_regprocedure('fn_bot_conversar(text,text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT fn_bot_conversar($1, $2, $3)' INTO v USING p_texto, p_chat, p_nombre;
    RETURN v;
  END IF;
  RETURN fn_bot_codigo(p_texto, p_chat, p_nombre);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- RN-82: resumen que Node-RED envía a recepción todos los días a las 8:00
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_resumen_diario(p_hotel UUID, p_dia DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
  ho RECORD; v_llegan TEXT; v_salen TEXT; v_limpiar TEXT; v_pendientes INT; v_ocupadas INT; v_total INT;
BEGIN
  SELECT nombre INTO ho FROM hoteles WHERE id = p_hotel;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COUNT(*) FILTER (WHERE activo) INTO v_total FROM habitaciones WHERE hotel_id = p_hotel;
  SELECT COUNT(*) INTO v_ocupadas FROM reservaciones
   WHERE hotel_id = p_hotel AND estado IN ('confirmada', 'check_in') AND p_dia >= fecha_entrada AND p_dia < fecha_salida;

  SELECT STRING_AGG(CONCAT('  • ', hab.numero, ' — ', INITCAP(hu.nombre), ' ', INITCAP(hu.apellidos),
                           CASE WHEN r.estado = 'pendiente' THEN ' (sin confirmar)' ELSE '' END), E'\n' ORDER BY hab.numero)
    INTO v_llegan
  FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id JOIN habitaciones hab ON hab.id = r.habitacion_id
  WHERE r.hotel_id = p_hotel AND r.fecha_entrada = p_dia AND r.estado IN ('pendiente', 'confirmada');

  SELECT STRING_AGG(CONCAT('  • ', hab.numero, ' — ', INITCAP(hu.nombre), ' ', INITCAP(hu.apellidos),
                           CASE WHEN s.saldo > 0 THEN CONCAT(' (debe ', fn_pesos(s.saldo), ')') ELSE '' END), E'\n' ORDER BY hab.numero)
    INTO v_salen
  FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id JOIN habitaciones hab ON hab.id = r.habitacion_id
  JOIN v_saldo_reservaciones s ON s.id = r.id
  WHERE r.hotel_id = p_hotel AND r.fecha_salida = p_dia AND r.estado = 'check_in';

  SELECT STRING_AGG(numero, ', ' ORDER BY numero) INTO v_limpiar
  FROM habitaciones WHERE hotel_id = p_hotel AND estado = 'limpieza';

  SELECT COUNT(*) INTO v_pendientes FROM reservaciones
  WHERE hotel_id = p_hotel AND estado = 'pendiente' AND fecha_entrada >= p_dia;

  RETURN CONCAT(
    '☀️ Buenos días, ', ho.nombre, E'\n', 'Resumen del ', fn_fecha(p_dia), E'\n\n',
    '🏨 Ocupación: ', v_ocupadas, ' de ', v_total, ' (', ROUND(100.0 * v_ocupadas / NULLIF(v_total, 0)), '%)', E'\n\n',
    '🧳 Llegan hoy:', E'\n', COALESCE(v_llegan, '  Nadie'), E'\n\n',
    '👋 Salen hoy:', E'\n', COALESCE(v_salen, '  Nadie'), E'\n\n',
    '🧹 Por limpiar: ', COALESCE(v_limpiar, 'ninguna'),
    CASE WHEN v_pendientes > 0 THEN CONCAT(E'\n', '⏳ Reservaciones sin confirmar: ', v_pendientes) ELSE '' END);
END;
$$ LANGUAGE plpgsql STABLE;

-- Hoteles a los que se les manda el resumen (los que tienen chat de recepción registrado)
CREATE OR REPLACE VIEW v_hoteles_con_telegram AS
SELECT id, nombre, telegram_chat_id FROM hoteles WHERE activo AND telegram_chat_id IS NOT NULL;
