-- =====================================================================
--  FUNCIONES DE CADENA EN POSTGRESQL — aplicadas al PMS hotelero
--  Tema: manejo y transformación de datos de texto
--
--  Uso:  psql -h localhost -U pms_admin -d hotel_pms -f database/04_funciones_cadena.sql
--
--  Parte 1 y 2: solo consultas (no cambian nada), para practicar y explicar.
--  Parte 3: crea una vista y un trigger que el proyecto usa de verdad.
-- =====================================================================
\pset pager off

-- ---------------------------------------------------------------------
-- PARTE 0. ¡El proyecto ya usaba funciones de cadena!
-- En 01_schema.sql, el código de cada reservación se genera así:
--
--   upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
--
--   1) gen_random_uuid()::text  →  'a1b2c3d4-e5f6-...'   (UUID como texto)
--   2) replace(..., '-', '')    →  'a1b2c3d4e5f6...'     (quita los guiones)
--   3) substr(..., 1, 8)        →  'a1b2c3d4'            (primeros 8 caracteres)
--   4) upper(...)               →  'A1B2C3D4'            (a mayúsculas)
-- ---------------------------------------------------------------------
\echo '\n=== 0. Así se generan los códigos de reservación (paso a paso) ==='
SELECT u                                   AS uuid_original,
       replace(u, '-', '')                 AS paso_replace,
       substr(replace(u, '-', ''), 1, 8)   AS paso_substr,
       upper(substr(replace(u, '-', ''), 1, 8)) AS codigo_final
FROM (SELECT gen_random_uuid()::text AS u) t;


-- =====================================================================
-- PARTE 1. CONCAT y CONCAT_WS — unir textos
-- =====================================================================

\echo '\n=== 1.1 CONCAT: nombre completo del huésped ==='
SELECT CONCAT(nombre, ' ', apellidos) AS nombre_completo,
       email
FROM huespedes;

\echo '\n=== 1.2 CONCAT vs ||: con valores NULL ==='
-- CONCAT ignora los NULL; el operador || devuelve NULL si alguna parte es NULL.
-- Lucas no tiene teléfono: con || se pierde toda la línea.
SELECT nombre,
       CONCAT(nombre, ' - Tel: ', telefono) AS con_concat,
       nombre || ' - Tel: ' || telefono     AS con_barras
FROM huespedes;

\echo '\n=== 1.3 CONCAT_WS: unir con separador (salta los NULL) ==='
-- WS = "with separator". Útil para direcciones o datos de contacto.
SELECT CONCAT_WS(' | ', CONCAT(nombre, ' ', apellidos), email, telefono, ciudad_origen) AS ficha_contacto
FROM huespedes;

\echo '\n=== 1.4 CONCAT para armar una descripción de habitación ==='
SELECT h.nombre AS hotel,
       CONCAT('Hab. ', hab.numero, ' · ', t.nombre, ' · ', t.capacidad_adultos, ' adultos · $', t.precio_base, ' MXN/noche') AS descripcion
FROM habitaciones hab
JOIN tipos_habitacion t ON t.id = hab.tipo_id
JOIN hoteles h ON h.id = hab.hotel_id
ORDER BY h.nombre, hab.numero;


-- =====================================================================
-- PARTE 2. REPLACE y otras funciones de cadena
-- =====================================================================

\echo '\n=== 2.1 REPLACE: limpiar un teléfono capturado con espacios y guiones ==='
SELECT '961-123 45 67'                                     AS como_lo_capturaron,
       REPLACE(REPLACE('961-123 45 67', '-', ''), ' ', '') AS limpio_con_replace,
       REGEXP_REPLACE('(961) 123-45.67', '[^0-9]', '', 'g') AS limpio_con_regexp;
-- REPLACE cambia un texto exacto; REGEXP_REPLACE usa un patrón
-- ([^0-9] = "todo lo que NO sea número") y limpia cualquier símbolo de un jalón.

\echo '\n=== 2.2 REPLACE: cambiar texto dentro de una plantilla de mensaje ==='
SELECT REPLACE(REPLACE('Hola {nombre}, tu código es {codigo}.', '{nombre}', hu.nombre), '{codigo}', r.codigo) AS mensaje
FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id;

\echo '\n=== 2.3 UPPER, LOWER, INITCAP y TRIM: normalizar lo que captura recepción ==='
SELECT '  maRÍA   lópez  '                      AS capturado,
       TRIM('  maRÍA   lópez  ')                 AS con_trim,
       UPPER(TRIM('  maRÍA   lópez  '))          AS con_upper,
       LOWER('ANA@CORREO.COM')                   AS email_lower,
       INITCAP(TRIM(REGEXP_REPLACE('  maRÍA   lópez  ', '\s+', ' ', 'g'))) AS bien_escrito;

\echo '\n=== 2.4 LENGTH, LEFT, RIGHT, REPEAT: ocultar el documento de identidad ==='
-- En pantalla de recepción solo se muestran los últimos 4 caracteres.
SELECT CONCAT(nombre, ' ', apellidos)                                        AS huesped,
       tipo_documento,
       LENGTH(num_documento)                                                 AS largo,
       CONCAT(REPEAT('*', LENGTH(num_documento) - 4), RIGHT(num_documento, 4)) AS documento_oculto,
       LEFT(nombre, 1) || LEFT(apellidos, 1)                                  AS iniciales
FROM huespedes;

\echo '\n=== 2.5 SPLIT_PART y POSITION: separar el correo ==='
SELECT email,
       SPLIT_PART(email::text, '@', 1) AS usuario,
       SPLIT_PART(email::text, '@', 2) AS dominio,
       POSITION('@' IN email::text)    AS posicion_arroba
FROM huespedes WHERE email IS NOT NULL;

\echo '\n=== 2.6 LPAD: folio con ceros a la izquierda ==='
SELECT codigo,
       CONCAT('FOLIO-', TO_CHAR(created_at, 'YYYY'), '-', LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 5, '0')) AS folio
FROM reservaciones;

\echo '\n=== 2.7 STRING_AGG: lista de habitaciones de cada hotel en una sola línea ==='
SELECT h.nombre AS hotel,
       STRING_AGG(hab.numero, ', ' ORDER BY hab.numero) AS habitaciones
FROM hoteles h JOIN habitaciones hab ON hab.hotel_id = h.id
GROUP BY h.nombre;

\echo '\n=== 2.8 ILIKE: buscar huésped sin importar mayúsculas (buscador de recepción) ==='
SELECT CONCAT(nombre, ' ', apellidos) AS encontrado
FROM huespedes
WHERE CONCAT(nombre, ' ', apellidos) ILIKE '%martínez%';


-- =====================================================================
-- PARTE 3. Uso real en el proyecto (esto SÍ crea objetos en la BD)
-- =====================================================================

-- 3.1 Vista con el mensaje de Telegram ya armado.
-- n8n solo hace: SELECT mensaje FROM v_mensajes_reservacion WHERE codigo = '...'
CREATE OR REPLACE VIEW v_mensajes_reservacion AS
SELECT r.id,
       r.codigo,
       hu.telegram_chat_id,
       CONCAT(
         '🏨 ', ho.nombre, E'\n',
         'Hola ', INITCAP(hu.nombre), ', tu reservación está ', UPPER(r.estado::text), E'.\n',
         '🔑 Código: ', r.codigo, E'\n',
         '🛏️ Habitación ', hab.numero, ' (', t.nombre, E')\n',
         '📅 Del ', TO_CHAR(r.fecha_entrada, 'DD/MM/YYYY'), ' al ', TO_CHAR(r.fecha_salida, 'DD/MM/YYYY'),
         ' · ', r.noches, CASE WHEN r.noches = 1 THEN ' noche' ELSE ' noches' END, E'\n',
         '💵 Total: $', TO_CHAR(r.total, 'FM999,999,990.00'), E' MXN\n',
         '⏰ Check-in desde las ', TO_CHAR(ho.hora_check_in, 'HH24:MI'), ' hrs.'
       ) AS mensaje
FROM reservaciones r
JOIN huespedes hu ON hu.id = r.huesped_id
JOIN habitaciones hab ON hab.id = r.habitacion_id
JOIN tipos_habitacion t ON t.id = hab.tipo_id
JOIN hoteles ho ON ho.id = r.hotel_id;

-- 3.2 Trigger que limpia los datos del huésped antes de guardarlos.
-- Así da igual cómo lo capture recepción: siempre queda bien escrito.
CREATE OR REPLACE FUNCTION fn_normalizar_huesped() RETURNS trigger AS $$
BEGIN
  NEW.nombre        := INITCAP(TRIM(REGEXP_REPLACE(NEW.nombre,    '\s+', ' ', 'g')));
  NEW.apellidos     := INITCAP(TRIM(REGEXP_REPLACE(NEW.apellidos, '\s+', ' ', 'g')));
  NEW.telefono      := NULLIF(REGEXP_REPLACE(NEW.telefono, '[^0-9+]', '', 'g'), '');
  NEW.num_documento := NULLIF(UPPER(REPLACE(NEW.num_documento, ' ', '')), '');
  NEW.ciudad_origen := INITCAP(TRIM(NEW.ciudad_origen));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SET client_min_messages = warning;  -- oculta el aviso "does not exist, skipping"
DROP TRIGGER IF EXISTS trg_normalizar_huesped ON huespedes;
CREATE TRIGGER trg_normalizar_huesped
  BEFORE INSERT OR UPDATE ON huespedes
  FOR EACH ROW EXECUTE FUNCTION fn_normalizar_huesped();

\echo '\n=== 3.1 Mensaje de Telegram generado con CONCAT ==='
SELECT codigo, mensaje FROM v_mensajes_reservacion LIMIT 1;

\echo '\n=== 3.2 Prueba del trigger (se deshace al final, no deja datos) ==='
BEGIN;
INSERT INTO huespedes (nombre, apellidos, telefono, tipo_documento, num_documento, ciudad_origen)
VALUES ('  jUAN   carlos ', 'pérez   GÓMEZ', '(961) 555-12 34', 'INE', 'pegj 850101', 'tuxtla gutiérrez');
SELECT nombre, apellidos, telefono, num_documento, ciudad_origen
FROM huespedes WHERE num_documento = 'PEGJ850101';
ROLLBACK;
