-- =====================================================================
--  BOT DE HUÉSPEDES (rol "cliente" por Telegram) — RN-89 a RN-93
--     psql -h localhost -U pms_admin -d hotel_pms -f database/14_bot_huespedes.sql
--  Requiere 09_notificaciones.sql. Se puede ejecutar varias veces.
--
--  El huésped conversa con el bot (Node-RED) y puede:
--    1. Ver las habitaciones y sus precios
--    2. Consultar disponibilidad en sus fechas y RESERVAR
--    3. Ver sus reservaciones
--    4. Elegir cómo pagar: en efectivo en el mostrador, o un pago SIMULADO
--       para la demostración (el sistema no maneja dinero real).
--
--  Node-RED no cambia: sigue llamando fn_bot_responder(texto, chat, nombre).
--  La conversación (en qué paso va cada chat) se guarda en bot_conversaciones.
-- =====================================================================
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS bot_conversaciones (
  chat_id     VARCHAR(40) PRIMARY KEY,
  paso        VARCHAR(30) NOT NULL,
  datos       JSONB NOT NULL DEFAULT '{}',
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anticipo que se pide al reservar. RN-53 sigue abierta (el hotel debe definirlo);
-- mientras tanto: 30 %, redondeado hacia arriba a la centena (como la consulta 6.3).
CREATE OR REPLACE FUNCTION fn_bot_anticipo(p_total NUMERIC) RETURNS NUMERIC AS $$
  SELECT LEAST(p_total, CEIL(p_total * 0.30 / 100) * 100);
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- Entiende fechas como las escribe la gente:
--   "hoy", "mañana", "20/12", "20-12-2026", "2026-12-20", "20 de diciembre", "20 dic 2026"
-- Sin año: este año, o el siguiente si esa fecha ya pasó.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bot_fecha(p_texto TEXT) RETURNS DATE AS $$
DECLARE
  t TEXT := LOWER(TRIM(TRANSLATE(COALESCE(p_texto, ''), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')));
  m TEXT[]; v_dia INT; v_mes INT; v_anio INT; v_fecha DATE;
  meses CONSTANT TEXT[] := ARRAY['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
BEGIN
  t := REGEXP_REPLACE(t, '^(el|para el|llego el|del)\s+', '');
  IF t = 'hoy' THEN RETURN CURRENT_DATE; END IF;
  IF t IN ('manana', 'mañana') THEN RETURN CURRENT_DATE + 1; END IF;
  IF t IN ('pasado manana', 'pasado mañana') THEN RETURN CURRENT_DATE + 2; END IF;

  m := REGEXP_MATCH(t, '^(\d{4})-(\d{1,2})-(\d{1,2})$');
  IF m IS NOT NULL THEN v_anio := m[1]::int; v_mes := m[2]::int; v_dia := m[3]::int;
  ELSE
    m := REGEXP_MATCH(t, '^(\d{1,2})\s*[/.-]\s*(\d{1,2})(\s*[/.-]\s*(\d{2,4}))?$');
    IF m IS NOT NULL THEN v_dia := m[1]::int; v_mes := m[2]::int; v_anio := m[4]::int;
    ELSE
      m := REGEXP_MATCH(t, '^(\d{1,2})\s*(de\s+)?([a-zñ]+)\.?(\s+(de|del)?\s*(\d{4}))?$');
      IF m IS NULL THEN RETURN NULL; END IF;
      v_dia := m[1]::int;
      v_mes := ARRAY_POSITION(meses, LEFT(m[3], 3));
      IF v_mes IS NULL THEN RETURN NULL; END IF;
      v_anio := m[6]::int;
    END IF;
  END IF;

  IF v_anio IS NOT NULL AND v_anio < 100 THEN v_anio := 2000 + v_anio; END IF;
  BEGIN
    v_fecha := MAKE_DATE(COALESCE(v_anio, EXTRACT(YEAR FROM CURRENT_DATE)::int), v_mes, v_dia);
  EXCEPTION WHEN OTHERS THEN RETURN NULL;   -- 31/02, mes 13, etc.
  END;
  IF v_anio IS NULL AND v_fecha < CURRENT_DATE THEN v_fecha := v_fecha + INTERVAL '1 year'; END IF;
  RETURN v_fecha;
END;
$$ LANGUAGE plpgsql STABLE;

-- Guarda (o borra) el paso de la conversación
CREATE OR REPLACE FUNCTION fn_bot_paso(p_chat TEXT, p_paso TEXT, p_datos JSONB DEFAULT '{}') RETURNS VOID AS $$
BEGIN
  IF p_paso IS NULL THEN
    DELETE FROM bot_conversaciones WHERE chat_id = p_chat;
  ELSE
    INSERT INTO bot_conversaciones (chat_id, paso, datos, actualizado) VALUES (p_chat, p_paso, p_datos, now())
    ON CONFLICT (chat_id) DO UPDATE SET paso = EXCLUDED.paso, datos = EXCLUDED.datos, actualizado = now();
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_bot_menu(p_nombre TEXT) RETURNS TEXT AS $$
  -- Saludo general: no se usa el nombre de Telegram (puede ser un apodo)
  SELECT CONCAT('¡Hola! 👋 Soy el asistente de ',
    COALESCE((SELECT STRING_AGG(nombre, ' y ') FROM hoteles WHERE activo), 'el hotel'), '.', E'\n\n',
    'Escribe el número de lo que necesitas:', E'\n',
    '1️⃣ Ver habitaciones y precios', E'\n',
    '2️⃣ Hacer una reservación', E'\n',
    '3️⃣ Ver mis reservaciones', E'\n',
    '4️⃣ Pagar mi reservación', E'\n\n',
    'Si ya tienes un código de reservación, envíamelo para recibir aquí tus avisos. ',
    'Escribe "menu" en cualquier momento para volver aquí.');
$$ LANGUAGE sql STABLE;

-- Opción 1: tipos de habitación con capacidad y precio
CREATE OR REPLACE FUNCTION fn_bot_habitaciones() RETURNS TEXT AS $$
  SELECT CONCAT('🏨 Nuestras habitaciones:', E'\n',
    STRING_AGG(CONCAT('• ', t.nombre, ' — hasta ', t.capacidad_adultos, ' adulto(s)',
                      CASE WHEN t.capacidad_ninos > 0 THEN CONCAT(' y ', t.capacidad_ninos, ' niño(s)') ELSE '' END,
                      ' · desde ', fn_pesos(t.precio_base), ' la noche'
                      || CASE WHEN (SELECT COUNT(*) FROM hoteles WHERE activo) > 1 THEN ' (' || ho.nombre || ')' ELSE '' END),
               E'\n' ORDER BY ho.nombre, t.precio_base),
    E'\n\n', 'En temporada alta (Navidad, Semana Santa) el precio puede subir.', E'\n',
    'Escribe 2 para ver qué hay libre en tus fechas y reservar.')
  FROM tipos_habitacion t JOIN hoteles ho ON ho.id = t.hotel_id
  WHERE t.activo AND ho.activo
    AND EXISTS (SELECT 1 FROM habitaciones h WHERE h.tipo_id = t.id AND h.activo);
$$ LANGUAGE sql STABLE;

-- Tipos con cuartos libres en esas fechas, con el total calculado noche por noche (RN-61)
CREATE OR REPLACE FUNCTION fn_bot_opciones(p_entrada DATE, p_salida DATE, p_adultos INT, p_ninos INT)
RETURNS JSONB AS $$
  SELECT COALESCE(JSONB_AGG(x ORDER BY (x->>'total')::numeric), '[]'::jsonb) FROM (
    SELECT JSONB_BUILD_OBJECT('tipo_id', t.id, 'hotel_id', t.hotel_id, 'nombre', t.nombre, 'libres', COUNT(h.id),
                              'total', pr.total, 'temporada', pr.con_temporada) AS x
    FROM tipos_habitacion t
    JOIN habitaciones h ON h.tipo_id = t.id
    CROSS JOIN LATERAL (
      SELECT SUM(COALESCE(tt.precio_noche, t.precio_base)) AS total, BOOL_OR(tt.id IS NOT NULL) AS con_temporada
      FROM generate_series(p_entrada, p_salida - 1, interval '1 day') AS noche
      LEFT JOIN tarifas_temporada tt ON tt.tipo_id = t.id AND noche::date >= tt.fecha_inicio AND noche::date < tt.fecha_fin
    ) pr
    WHERE t.activo AND h.activo AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
      AND t.capacidad_adultos >= p_adultos AND t.capacidad_ninos >= p_ninos
      AND NOT EXISTS (SELECT 1 FROM reservaciones r
                      WHERE r.habitacion_id = h.id AND r.estado IN ('pendiente', 'confirmada', 'check_in')
                        AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_entrada, p_salida, '[)'))
    GROUP BY t.id, t.hotel_id, t.nombre, pr.total, pr.con_temporada
  ) o;
$$ LANGUAGE sql STABLE;

-- Reservaciones activas con saldo de este chat
CREATE OR REPLACE FUNCTION fn_bot_por_pagar(p_chat TEXT) RETURNS JSONB AS $$
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('id', r.id, 'codigo', r.codigo, 'total', s.total, 'pagado', s.pagado,
                                               'saldo', s.saldo, 'entrada', r.fecha_entrada) ORDER BY r.fecha_entrada), '[]'::jsonb)
  FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id JOIN v_saldo_reservaciones s ON s.id = r.id
  WHERE hu.telegram_chat_id = p_chat AND r.estado IN ('pendiente', 'confirmada', 'check_in') AND s.saldo > 0;
$$ LANGUAGE sql STABLE;

-- Pregunta cómo quiere pagar una reservación
CREATE OR REPLACE FUNCTION fn_bot_preguntar_pago(p_chat TEXT, p_res JSONB) RETURNS TEXT AS $$
DECLARE v_anticipo NUMERIC;
BEGIN
  v_anticipo := CASE WHEN (p_res->>'pagado')::numeric = 0 THEN fn_bot_anticipo((p_res->>'total')::numeric) END;
  PERFORM fn_bot_paso(p_chat, 'pago_forma', JSONB_BUILD_OBJECT('reservacion', p_res, 'anticipo', v_anticipo));
  RETURN CONCAT('💵 Reservación ', p_res->>'codigo', ': total ', fn_pesos((p_res->>'total')::numeric),
    ', pagado ', fn_pesos((p_res->>'pagado')::numeric), ', saldo ', fn_pesos((p_res->>'saldo')::numeric), '.', E'\n\n',
    '¿Cómo quieres pagar?', E'\n',
    '1️⃣ En efectivo en el mostrador, al llegar', E'\n',
    CASE WHEN v_anticipo IS NOT NULL AND v_anticipo < (p_res->>'saldo')::numeric
         THEN CONCAT('2️⃣ Pagar ahora el anticipo de ', fn_pesos(v_anticipo), ' (simulado)', E'\n',
                     '3️⃣ Pagar ahora todo, ', fn_pesos((p_res->>'saldo')::numeric), ' (simulado)')
         ELSE CONCAT('2️⃣ Pagar ahora ', fn_pesos((p_res->>'saldo')::numeric), ' (simulado)') END, E'\n\n',
    'ℹ️ Es una demostración: el pago "ahora" no cobra dinero real.');
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- RN-89 a RN-93: la conversación completa
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bot_conversar(p_texto TEXT, p_chat TEXT, p_nombre TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_t     TEXT := TRIM(COALESCE(p_texto, ''));
  v_low   TEXT := LOWER(TRANSLATE(TRIM(COALESCE(p_texto, '')), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'));
  c       RECORD;
  d       JSONB;
  v_paso  TEXT;
  v_f     DATE;
  v_n     INT[];
  v_op    JSONB;
  v_lista TEXT;
  v_hu    UUID;
  v_hab   RECORD;
  v_res   RECORD;
  v_res_id UUID;
  v_codigo TEXT;
  v_monto NUMERIC;
  v_ref   TEXT;
  i       INT;
BEGIN
  IF v_t = '' THEN RETURN NULL; END IF;

  -- Comandos que siempre funcionan
  IF v_low LIKE '/miid%' OR v_low LIKE '/estado%' THEN RETURN fn_bot_codigo(v_t, p_chat, p_nombre); END IF;
  IF v_low ~ '^/start\s+\S' THEN PERFORM fn_bot_paso(p_chat, NULL); RETURN fn_bot_codigo(v_t, p_chat, p_nombre); END IF;
  IF v_low IN ('/start', 'menu', '/menu', 'inicio', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'cancelar', 'salir', 'no')
     OR v_low ~ '^(hola|buen)' THEN
    PERFORM fn_bot_paso(p_chat, NULL);
    RETURN fn_bot_menu(p_nombre);
  END IF;

  -- ¿En qué paso va? (una conversación sin moverse 30 minutos se olvida)
  SELECT * INTO c FROM bot_conversaciones WHERE chat_id = p_chat AND actualizado > now() - INTERVAL '30 minutes';
  v_paso := COALESCE(c.paso, 'menu');
  d := COALESCE(c.datos, '{}');

  -- ===================== MENÚ =====================
  IF v_paso = 'menu' THEN
    IF v_low IN ('1', '1.') OR v_low ~ '(habitacion|cuarto|precio|tarifa|cuantas)' THEN
      RETURN fn_bot_habitaciones();
    ELSIF v_low IN ('2', '2.') OR v_low ~ 'reserv|disponib|libre' THEN
      PERFORM fn_bot_paso(p_chat, 'entrada');
      RETURN '📅 ¿Qué día llegas? Por ejemplo: 20/12, 20 de diciembre o mañana.';
    ELSIF v_low IN ('3', '3.') OR v_low ~ '^mis reserv' THEN
      RETURN fn_bot_codigo('/estado', p_chat, p_nombre);
    ELSIF v_low IN ('4', '4.') OR v_low ~ 'pag' THEN
      v_op := fn_bot_por_pagar(p_chat);
      IF JSONB_ARRAY_LENGTH(v_op) = 0 THEN
        RETURN 'No tienes reservaciones con saldo pendiente en este chat. Si reservaste por otro medio, envíame tu código de reservación.';
      ELSIF JSONB_ARRAY_LENGTH(v_op) = 1 THEN
        RETURN fn_bot_preguntar_pago(p_chat, v_op->0);
      END IF;
      SELECT STRING_AGG(CONCAT(n, '. ', e->>'codigo', ' · llegada ', fn_fecha((e->>'entrada')::date), ' · saldo ', fn_pesos((e->>'saldo')::numeric)), E'\n' ORDER BY n)
        INTO v_lista FROM JSONB_ARRAY_ELEMENTS(v_op) WITH ORDINALITY AS a(e, n);
      PERFORM fn_bot_paso(p_chat, 'pago_cual', JSONB_BUILD_OBJECT('lista', v_op));
      RETURN CONCAT('¿Cuál reservación quieres pagar?', E'\n', v_lista, E'\n', 'Escribe el número.');
    END IF;
    -- Si no eligió una opción, quizá envió su código de reservación (vincular chat)
    RETURN fn_bot_codigo(v_t, p_chat, p_nombre);
  END IF;

  -- ===================== RESERVAR =====================
  IF v_paso = 'entrada' THEN
    v_f := fn_bot_fecha(v_t);
    IF v_f IS NULL AND v_low IN ('ayer', 'antier') THEN RETURN 'Esa fecha ya pasó. ¿Qué día llegas?'; END IF;
    IF v_f IS NULL THEN RETURN 'No entendí la fecha 🤔. Escríbela como 20/12 o 20 de diciembre.'; END IF;
    IF v_f < CURRENT_DATE THEN RETURN 'Esa fecha ya pasó. ¿Qué día llegas?'; END IF;                    -- RN-14
    IF v_f > CURRENT_DATE + 365 THEN RETURN 'Solo reservamos con hasta un año de anticipación. ¿Qué día llegas?'; END IF;
    PERFORM fn_bot_paso(p_chat, 'salida', JSONB_BUILD_OBJECT('entrada', v_f));
    RETURN CONCAT('Llegas el ', fn_fecha(v_f), '. ¿Qué día te vas? También puedes escribir cuántas noches (por ejemplo: 3).');
  END IF;

  IF v_paso = 'salida' THEN
    IF v_low ~ '^\d{1,2}( noches?)?$' THEN
      v_f := (d->>'entrada')::date + (REGEXP_MATCH(v_low, '^\d+'))[1]::int;
    ELSE
      v_f := fn_bot_fecha(v_t);
    END IF;
    IF v_f IS NULL THEN RETURN 'No entendí. Escribe la fecha de salida (20/12) o el número de noches (3).'; END IF;
    IF v_f <= (d->>'entrada')::date THEN RETURN 'La salida debe ser después de la llegada. ¿Qué día te vas?'; END IF;  -- RN-04
    IF v_f - (d->>'entrada')::date > 30 THEN RETURN 'Por el bot se reservan máximo 30 noches. Para estancias largas llámanos. ¿Qué día te vas?'; END IF;
    PERFORM fn_bot_paso(p_chat, 'personas', d || JSONB_BUILD_OBJECT('salida', v_f));
    RETURN '👥 ¿Cuántas personas? Por ejemplo: "2" o "2 adultos y 1 niño".';
  END IF;

  IF v_paso = 'personas' THEN
    SELECT ARRAY_AGG(x[1]::int) INTO v_n FROM REGEXP_MATCHES(v_low, '(\d+)', 'g') AS x;
    IF v_n IS NULL OR v_n[1] < 1 OR v_n[1] > 10 THEN RETURN 'Escribe cuántos adultos (y niños, si vienen). Por ejemplo: 2 adultos y 1 niño.'; END IF;
    d := d || JSONB_BUILD_OBJECT('adultos', v_n[1], 'ninos', COALESCE(v_n[2], 0));
    v_op := fn_bot_opciones((d->>'entrada')::date, (d->>'salida')::date, v_n[1], COALESCE(v_n[2], 0));
    IF JSONB_ARRAY_LENGTH(v_op) = 0 THEN
      PERFORM fn_bot_paso(p_chat, 'entrada');
      RETURN CONCAT('😕 No tenemos habitaciones libres para ', v_n[1], ' adulto(s)',
                    CASE WHEN COALESCE(v_n[2], 0) > 0 THEN CONCAT(' y ', v_n[2], ' niño(s)') ELSE '' END,
                    ' en esas fechas.', E'\n', 'Probemos con otras: ¿qué día llegas?');
    END IF;
    SELECT STRING_AGG(CONCAT(n, '. ', o->>'nombre', ' — ', fn_pesos((o->>'total')::numeric), ' en total',
                             CASE WHEN (o->>'temporada')::boolean THEN ' (tarifa de temporada)' ELSE '' END,
                             ' · ', o->>'libres', ' libre(s)'), E'\n' ORDER BY n)
      INTO v_lista FROM JSONB_ARRAY_ELEMENTS(v_op) WITH ORDINALITY AS a(o, n);
    PERFORM fn_bot_paso(p_chat, 'opcion', d || JSONB_BUILD_OBJECT('opciones', v_op));
    RETURN CONCAT('Del ', fn_fecha((d->>'entrada')::date), ' al ', fn_fecha((d->>'salida')::date), ' (',
                  (d->>'salida')::date - (d->>'entrada')::date, ' noches) tenemos:', E'\n', v_lista, E'\n\n',
                  'Escribe el número de la que quieres.');
  END IF;

  IF v_paso = 'opcion' THEN
    i := NULLIF(REGEXP_REPLACE(v_low, '\D', '', 'g'), '')::int;
    IF i IS NULL OR i < 1 OR i > JSONB_ARRAY_LENGTH(d->'opciones') THEN
      RETURN CONCAT('Escribe un número del 1 al ', JSONB_ARRAY_LENGTH(d->'opciones'), '.');
    END IF;
    d := (d - 'opciones') || JSONB_BUILD_OBJECT('elegida', d->'opciones'->(i - 1));
    -- ¿Ya lo conocemos por este chat? Entonces no le volvemos a pedir sus datos
    SELECT id INTO v_hu FROM huespedes WHERE telegram_chat_id = p_chat ORDER BY updated_at DESC LIMIT 1;
    IF v_hu IS NOT NULL THEN
      d := d || JSONB_BUILD_OBJECT('huesped_id', v_hu);
      PERFORM fn_bot_paso(p_chat, 'confirmar', d);
      RETURN fn_bot_conversar('__resumen__', p_chat, p_nombre);
    END IF;
    PERFORM fn_bot_paso(p_chat, 'nombre', d);
    RETURN '✍️ ¿A nombre de quién hacemos la reservación? Escribe nombre y apellidos.';
  END IF;

  IF v_paso = 'nombre' THEN
    IF v_t !~ '^\S+\s+\S+' OR LENGTH(v_t) > 120 OR v_t ~ '\d' THEN
      RETURN 'Escribe tu nombre y al menos un apellido, por ejemplo: Ana López Ruiz.';
    END IF;
    PERFORM fn_bot_paso(p_chat, 'telefono', d || JSONB_BUILD_OBJECT(
      'nombre', SPLIT_PART(REGEXP_REPLACE(v_t, '\s+', ' ', 'g'), ' ', 1),
      'apellidos', SUBSTRING(REGEXP_REPLACE(v_t, '\s+', ' ', 'g') FROM POSITION(' ' IN REGEXP_REPLACE(v_t, '\s+', ' ', 'g')) + 1)));
    RETURN '📱 ¿Un teléfono de contacto? (10 dígitos)';
  END IF;

  IF v_paso = 'telefono' THEN
    v_ref := REGEXP_REPLACE(REGEXP_REPLACE(v_t, '\D', '', 'g'), '^52(\d{10})$', '\1');
    IF v_ref !~ '^\d{10}$' THEN RETURN 'El teléfono debe tener 10 dígitos, por ejemplo: 9611234567.'; END IF;
    -- RN-31: si ya es huésped (mismo teléfono Y mismo nombre), se usa su registro en lugar de duplicarlo.
    -- Solo con el teléfono no basta: el bot nunca debe mostrarle a un desconocido los datos de otra persona.
    SELECT id INTO v_hu FROM huespedes
    WHERE REGEXP_REPLACE(telefono, '\D', '', 'g') = v_ref
      AND LOWER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = LOWER(TRANSLATE(d->>'nombre', 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
    ORDER BY updated_at DESC LIMIT 1;
    d := d || JSONB_BUILD_OBJECT('telefono', v_ref) || CASE WHEN v_hu IS NOT NULL THEN JSONB_BUILD_OBJECT('huesped_id', v_hu) ELSE '{}' END;
    PERFORM fn_bot_paso(p_chat, 'confirmar', d);
    RETURN fn_bot_conversar('__resumen__', p_chat, p_nombre);
  END IF;

  IF v_paso = 'confirmar' AND v_t = '__resumen__' THEN
    RETURN CONCAT('📝 Revisa tu reservación:', E'\n',
      '• ', d->'elegida'->>'nombre', E'\n',
      '• Del ', fn_fecha((d->>'entrada')::date), ' al ', fn_fecha((d->>'salida')::date),
      ' (', (d->>'salida')::date - (d->>'entrada')::date, ' noches)', E'\n',
      '• ', d->>'adultos', ' adulto(s)', CASE WHEN (d->>'ninos')::int > 0 THEN CONCAT(' y ', d->>'ninos', ' niño(s)') ELSE '' END, E'\n',
      '• A nombre de ', COALESCE((SELECT INITCAP(nombre || ' ' || apellidos) FROM huespedes WHERE id = (d->>'huesped_id')::uuid),
                                 INITCAP(CONCAT(d->>'nombre', ' ', d->>'apellidos'))), E'\n',
      '• Total: ', fn_pesos((d->'elegida'->>'total')::numeric), E'\n\n',
      'Escribe SI para reservar o NO para cancelar.');
  END IF;

  IF v_paso = 'confirmar' THEN
    IF v_low NOT IN ('si', 'sí', 's', 'ok', 'va', 'confirmo', 'reservar') THEN
      RETURN 'Escribe SI para reservar o NO para cancelar.';
    END IF;
    -- Huésped: el que ya existe o uno nuevo (el trigger de 04 normaliza nombre y teléfono)
    v_hu := (d->>'huesped_id')::uuid;
    IF v_hu IS NULL THEN
      INSERT INTO huespedes (nombre, apellidos, telefono, telegram_chat_id, notas)
      VALUES (d->>'nombre', d->>'apellidos', d->>'telefono', p_chat, 'Registrado por el bot de Telegram')
      RETURNING id INTO v_hu;
    ELSE
      UPDATE huespedes SET telegram_chat_id = p_chat WHERE id = v_hu;
    END IF;

    -- RN-01: se intenta cada cuarto libre del tipo elegido. Si otra persona lo
    -- acaba de apartar, la restricción EXCLUDE lo impide y se prueba el siguiente.
    FOR v_hab IN
      SELECT h.id, h.numero FROM habitaciones h
      WHERE h.tipo_id = (d->'elegida'->>'tipo_id')::uuid AND h.activo AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
      ORDER BY h.numero
    LOOP
      BEGIN
        INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida, num_adultos, num_ninos,
                                   precio_noche, total, estado, canal, solicitudes_especiales)
        VALUES ((d->'elegida'->>'hotel_id')::uuid, v_hu, v_hab.id, (d->>'entrada')::date, (d->>'salida')::date,
                (d->>'adultos')::int, (d->>'ninos')::int,
                ROUND((d->'elegida'->>'total')::numeric / ((d->>'salida')::date - (d->>'entrada')::date), 2),
                (d->'elegida'->>'total')::numeric, 'pendiente', 'telegram', 'Reservada por el bot de Telegram')
        RETURNING id, codigo INTO v_res_id, v_codigo;
        EXIT;
      EXCEPTION WHEN exclusion_violation THEN
        NULL;   -- ocupado: siguiente cuarto
      END;
    END LOOP;

    IF v_res_id IS NULL THEN
      PERFORM fn_bot_paso(p_chat, 'entrada');
      RETURN '😕 Alguien acaba de reservar la última habitación de ese tipo. Probemos de nuevo: ¿qué día llegas?';
    END IF;

    -- RN-93: aviso a recepción (lo envía n8n)
    INSERT INTO eventos_dominio (tipo, agregado, agregado_id, payload)
    VALUES ('reservacion.por_bot', 'reservacion', v_res_id, JSONB_BUILD_OBJECT('canal', 'telegram'));

    RETURN CONCAT('✅ ¡Listo! Tu reservación quedó apartada.', E'\n',
                  'Código: ', v_codigo, ' · Habitación ', v_hab.numero, E'\n\n',
                  fn_bot_preguntar_pago(p_chat, JSONB_BUILD_OBJECT('id', v_res_id, 'codigo', v_codigo,
                    'total', (d->'elegida'->>'total')::numeric, 'pagado', 0, 'saldo', (d->'elegida'->>'total')::numeric)));
  END IF;

  -- ===================== PAGAR (simulado) =====================
  IF v_paso = 'pago_cual' THEN
    i := NULLIF(REGEXP_REPLACE(v_low, '\D', '', 'g'), '')::int;
    IF i IS NULL OR i < 1 OR i > JSONB_ARRAY_LENGTH(d->'lista') THEN
      RETURN CONCAT('Escribe un número del 1 al ', JSONB_ARRAY_LENGTH(d->'lista'), '.');
    END IF;
    RETURN fn_bot_preguntar_pago(p_chat, d->'lista'->(i - 1));
  END IF;

  IF v_paso = 'pago_forma' THEN
    i := NULLIF(REGEXP_REPLACE(v_low, '\D', '', 'g'), '')::int;
    IF i = 1 OR v_low ~ 'efectivo|mostrador' THEN
      PERFORM fn_bot_paso(p_chat, NULL);
      RETURN CONCAT('👍 Perfecto. Pagas en efectivo en recepción al llegar.', E'\n',
        'Tu reservación ', d->'reservacion'->>'codigo', ' queda apartada; recepción la confirmará. ',
        'Te avisaremos por aquí. Escribe "menu" si necesitas algo más.');
    END IF;
    -- Monto: anticipo (solo si aún no ha pagado nada) o todo el saldo
    IF d->>'anticipo' IS NOT NULL AND (d->>'anticipo')::numeric < (d->'reservacion'->>'saldo')::numeric THEN
      v_monto := CASE i WHEN 2 THEN (d->>'anticipo')::numeric WHEN 3 THEN (d->'reservacion'->>'saldo')::numeric END;
    ELSE
      v_monto := CASE i WHEN 2 THEN (d->'reservacion'->>'saldo')::numeric END;
    END IF;
    IF v_monto IS NULL THEN RETURN 'Escribe el número de la opción.'; END IF;

    -- Saldo actual (alguien pudo cobrar en el mostrador mientras tanto)
    SELECT s.saldo, r.estado INTO v_res FROM v_saldo_reservaciones s JOIN reservaciones r ON r.id = s.id
    WHERE s.id = (d->'reservacion'->>'id')::uuid;
    v_monto := LEAST(v_monto, v_res.saldo);
    IF v_monto <= 0 THEN PERFORM fn_bot_paso(p_chat, NULL); RETURN '✅ Esa reservación ya está pagada.'; END IF;

    -- RN-92: pago SIMULADO. Queda registrado como cualquier pago (RN-54 y RN-55 se revisan
    -- en el trigger de pagos) con una referencia que dice que es simulación.
    v_ref := 'SIMULADO-' || UPPER(SUBSTR(MD5(RANDOM()::text), 1, 6));
    BEGIN
      INSERT INTO pagos (reservacion_id, monto, metodo, referencia, es_anticipo)
      VALUES ((d->'reservacion'->>'id')::uuid, v_monto, 'transferencia', v_ref, v_res.estado <> 'check_in');
    EXCEPTION WHEN check_violation THEN
      PERFORM fn_bot_paso(p_chat, NULL);
      RETURN '⚠️ No se pudo registrar el pago: ' || SQLERRM;
    END;
    -- Con el anticipo pagado, la reservación pendiente queda confirmada (RN-09)
    IF v_res.estado = 'pendiente' THEN
      UPDATE reservaciones SET estado = 'confirmada' WHERE id = (d->'reservacion'->>'id')::uuid;
    END IF;
    INSERT INTO eventos_dominio (tipo, agregado, agregado_id, payload)
    VALUES ('pago.por_bot', 'reservacion', (d->'reservacion'->>'id')::uuid, JSONB_BUILD_OBJECT('monto', v_monto, 'referencia', v_ref));
    PERFORM fn_bot_paso(p_chat, NULL);

    SELECT s.saldo INTO v_monto FROM v_saldo_reservaciones s WHERE s.id = (d->'reservacion'->>'id')::uuid;
    RETURN CONCAT('💳 Pago simulado aprobado.', E'\n',
      'Referencia: ', v_ref, E'\n',
      'Reservación ', d->'reservacion'->>'codigo', CASE WHEN v_res.estado = 'pendiente' THEN ' ✅ confirmada' ELSE '' END, E'\n',
      CASE WHEN v_monto > 0 THEN CONCAT('Saldo pendiente: ', fn_pesos(v_monto), ' (lo pagas al llegar).') ELSE 'Tu cuenta está liquidada. ¡Gracias!' END,
      E'\n\n', 'Escribe "menu" si necesitas algo más.');
  END IF;

  -- Paso desconocido: empezar de nuevo
  PERFORM fn_bot_paso(p_chat, NULL);
  RETURN fn_bot_menu(p_nombre);
END;
$$ LANGUAGE plpgsql;

-- Las reservaciones del bot y sus pagos simulados se ven en recepción como cualquier otra.
DELETE FROM bot_conversaciones WHERE actualizado < now() - INTERVAL '1 day';
