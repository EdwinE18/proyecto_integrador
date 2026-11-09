-- =====================================================================
--  CONSULTAS PARA LA EVALUACIÓN DE BASE DE DATOS — PMS Hoteles Boutique y Posadas
--
--  Temas: 1. Selección · 2. Proyección · 3. UNION · 4. Funciones
--         5. Subconsultas · 6. Funciones numéricas
--         7. Funciones de manipulación de caracteres · 8. Reglas de precedencia
--
--  Solo consultas (SELECT): no cambia ningún dato.
--  Para que se vean resultados interesantes, carga antes los datos de demostración:
--     psql -h localhost -U pms_admin -d hotel_pms -f database/10_datos_demo.sql
--  Ejecutar todo:
--     psql -h localhost -U pms_admin -d hotel_pms -f database/11_consultas_evaluacion.sql
--  O copiar y pegar una consulta a la vez en psql o DBeaver.
-- =====================================================================
\pset pager off
\pset null '—'


-- █████████████████████████████████████████████████████████████████████
-- 1. SELECCIÓN — elegir QUÉ FILAS se muestran (cláusula WHERE)
-- █████████████████████████████████████████████████████████████████████

\echo '\n[1.1] Selección con comparación: habitaciones de más de $1,000 la noche'
SELECT numero, precio_base
FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id
WHERE t.precio_base > 1000
ORDER BY t.precio_base DESC, numero;

\echo '\n[1.2] Selección con IN: reservaciones activas (las que ocupan un cuarto)'
SELECT codigo, estado, fecha_entrada, fecha_salida
FROM reservaciones
WHERE estado IN ('pendiente', 'confirmada', 'check_in')
ORDER BY fecha_entrada;

\echo '\n[1.3] Selección con BETWEEN: reservaciones que llegan en los próximos 7 días'
SELECT codigo, fecha_entrada, estado
FROM reservaciones
WHERE fecha_entrada BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY fecha_entrada;

\echo '\n[1.4] Selección con LIKE / ILIKE: huéspedes con apellido que empieza con "M" (sin importar mayúsculas)'
SELECT nombre, apellidos
FROM huespedes
WHERE apellidos ILIKE 'm%';

\echo '\n[1.5] Selección con IS NULL: huéspedes sin correo (solo se les puede contactar por teléfono)'
SELECT nombre, apellidos, telefono
FROM huespedes
WHERE email IS NULL;


-- █████████████████████████████████████████████████████████████████████
-- 2. PROYECCIÓN — elegir QUÉ COLUMNAS se muestran (lista del SELECT)
-- █████████████████████████████████████████████████████████████████████

\echo '\n[2.1] Proyección de columnas específicas (en lugar de SELECT *)'
SELECT nombre, ciudad, telefono
FROM hoteles;

\echo '\n[2.2] Proyección con alias y columnas calculadas'
SELECT codigo                           AS "Código",
       noches                           AS "Noches",
       precio_noche                     AS "Precio por noche",
       noches * precio_noche            AS "Subtotal calculado",
       fecha_salida - fecha_entrada     AS "Días (calculado)"
FROM reservaciones
WHERE estado <> 'cancelada';

\echo '\n[2.3] Proyección con DISTINCT: de qué ciudades vienen los huéspedes (sin repetir)'
SELECT DISTINCT ciudad_origen
FROM huespedes
WHERE ciudad_origen IS NOT NULL
ORDER BY ciudad_origen;

\echo '\n[2.4] Selección + proyección juntas: SOLO estas columnas DE SOLO estas filas'
SELECT hab.numero, t.nombre AS tipo, hab.estado
FROM habitaciones hab JOIN tipos_habitacion t ON t.id = hab.tipo_id
WHERE hab.estado <> 'disponible';


-- █████████████████████████████████████████████████████████████████████
-- 3. UNION — juntar el resultado de dos consultas en una sola lista
--    Las dos consultas deben tener el mismo número de columnas y tipos compatibles.
--    UNION quita duplicados; UNION ALL los conserva.
-- █████████████████████████████████████████████████████████████████████

\echo '\n[3.1] UNION: movimientos de hoy en un solo listado (llegadas + salidas)'
SELECT 'Llega' AS movimiento, hab.numero AS habitacion, CONCAT(hu.nombre, ' ', hu.apellidos) AS huesped
FROM reservaciones r
JOIN huespedes hu ON hu.id = r.huesped_id
JOIN habitaciones hab ON hab.id = r.habitacion_id
WHERE r.fecha_entrada = CURRENT_DATE AND r.estado IN ('pendiente', 'confirmada')
UNION
SELECT 'Sale', hab.numero, CONCAT(hu.nombre, ' ', hu.apellidos)
FROM reservaciones r
JOIN huespedes hu ON hu.id = r.huesped_id
JOIN habitaciones hab ON hab.id = r.habitacion_id
WHERE r.fecha_salida = CURRENT_DATE AND r.estado = 'check_in'
ORDER BY movimiento, habitacion;

\echo '\n[3.2] UNION: directorio de contactos (huéspedes y personal del hotel)'
SELECT CONCAT(nombre, ' ', apellidos) AS nombre, email::text AS correo, 'Huésped' AS tipo
FROM huespedes WHERE email IS NOT NULL
UNION
SELECT CONCAT(nombre, ' ', apellidos), email::text, 'Personal'
FROM usuarios
ORDER BY tipo, nombre;

\echo '\n[3.3] UNION vs UNION ALL: ciudades de huéspedes y de hoteles'
\echo '      UNION (sin repetir):'
SELECT ciudad_origen AS ciudad FROM huespedes WHERE ciudad_origen IS NOT NULL
UNION
SELECT ciudad FROM hoteles
ORDER BY ciudad;
\echo '      Conteo con UNION ALL (con repetidos) vs UNION (sin repetidos):'
SELECT (SELECT COUNT(*) FROM (SELECT ciudad_origen FROM huespedes WHERE ciudad_origen IS NOT NULL
                              UNION ALL SELECT ciudad FROM hoteles) a) AS con_union_all,
       (SELECT COUNT(*) FROM (SELECT ciudad_origen FROM huespedes WHERE ciudad_origen IS NOT NULL
                              UNION     SELECT ciudad FROM hoteles) b) AS con_union;

\echo '\n[3.4] UNION ALL: estado de cuenta (cargos y abonos en una sola lista, tipo banco)'
SELECT r.codigo, r.fecha_entrada AS fecha, 'Cargo por hospedaje' AS concepto, r.total AS cargo, NULL::numeric AS abono
FROM reservaciones r WHERE r.id = 'd0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT r.codigo, p.fecha_pago::date, CONCAT('Pago ', p.metodo, CASE WHEN p.es_anticipo THEN ' (anticipo)' ELSE '' END), NULL, p.monto
FROM pagos p JOIN reservaciones r ON r.id = p.reservacion_id
WHERE r.id = 'd0000000-0000-0000-0000-000000000001'
ORDER BY fecha;


-- █████████████████████████████████████████████████████████████████████
-- 4. FUNCIONES — de agregación, de fecha, de conversión y propias del sistema
-- █████████████████████████████████████████████████████████████████████

\echo '\n[4.1] Funciones de agregación (COUNT, SUM, AVG, MIN, MAX) con GROUP BY: ingresos por tipo de habitación'
SELECT t.nombre                      AS tipo_habitacion,
       COUNT(p.id)                   AS pagos,
       SUM(p.monto)                  AS cobrado,
       ROUND(AVG(p.monto), 2)        AS pago_promedio,
       MIN(p.monto)                  AS pago_menor,
       MAX(p.monto)                  AS pago_mayor
FROM pagos p
JOIN reservaciones r     ON r.id = p.reservacion_id
JOIN habitaciones h      ON h.id = r.habitacion_id
JOIN tipos_habitacion t  ON t.id = h.tipo_id
GROUP BY t.nombre
ORDER BY cobrado DESC;

\echo '\n[4.2] Agregación con HAVING: canales que han traído 2 o más reservaciones'
SELECT canal, COUNT(*) AS reservaciones
FROM reservaciones
GROUP BY canal
HAVING COUNT(*) >= 2
ORDER BY reservaciones DESC;

\echo '\n[4.3] Funciones de fecha: edad del huésped, mes de llegada y día de la semana'
SELECT nombre,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, fecha_nacimiento)) AS edad,
       TO_CHAR(fecha_nacimiento, 'DD/MM/YYYY')                AS nacimiento
FROM huespedes WHERE fecha_nacimiento IS NOT NULL
ORDER BY edad DESC;
SELECT codigo, fecha_entrada,
       EXTRACT(MONTH FROM fecha_entrada) AS mes,
       EXTRACT(ISODOW FROM fecha_entrada) AS dia_semana_1_lunes,
       CASE WHEN EXTRACT(ISODOW FROM fecha_entrada) IN (6, 7) THEN 'Fin de semana' ELSE 'Entre semana' END AS tipo_dia
FROM reservaciones ORDER BY fecha_entrada;

\echo '\n[4.4] Funciones de conversión y de nulos: CAST, COALESCE, NULLIF'
SELECT nombre,
       COALESCE(email::text, telefono, 'sin contacto') AS contacto_preferido,
       CAST(fecha_nacimiento AS TEXT)                   AS fecha_como_texto,
       NULLIF(nacionalidad, 'Mexicana')                 AS extranjero_de
FROM huespedes;

\echo '\n[4.5] Funciones propias del sistema (PL/pgSQL): cuartos libres para los próximos 2 días'
SELECT * FROM fn_habitaciones_disponibles('11111111-1111-1111-1111-111111111111', CURRENT_DATE, CURRENT_DATE + 2);

\echo '\n[4.6] Función propia que arma un texto completo: resumen diario para recepción'
SELECT fn_resumen_diario('11111111-1111-1111-1111-111111111111') AS resumen;


-- █████████████████████████████████████████████████████████████████████
-- 5. SUBCONSULTAS — una consulta dentro de otra
-- █████████████████████████████████████████████████████████████████████

\echo '\n[5.1] Subconsulta con IN (en el WHERE): huéspedes que tienen alguna reservación cancelada'
SELECT nombre, apellidos
FROM huespedes
WHERE id IN (SELECT huesped_id FROM reservaciones WHERE estado = 'cancelada');

\echo '\n[5.2] Subconsulta con NOT EXISTS: habitaciones LIBRES hoy (la base de la regla anti-sobreventa)'
SELECT h.numero, t.nombre AS tipo
FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id
WHERE NOT EXISTS (
  SELECT 1 FROM reservaciones r
  WHERE r.habitacion_id = h.id
    AND r.estado IN ('pendiente', 'confirmada', 'check_in')
    AND CURRENT_DATE >= r.fecha_entrada AND CURRENT_DATE < r.fecha_salida)
ORDER BY h.numero;

\echo '\n[5.3] Subconsulta escalar (en el SELECT): cuántas reservaciones y cuánto ha gastado cada huésped'
SELECT hu.nombre,
       (SELECT COUNT(*) FROM reservaciones r WHERE r.huesped_id = hu.id)                    AS reservaciones,
       (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p
          JOIN reservaciones r ON r.id = p.reservacion_id WHERE r.huesped_id = hu.id)       AS total_pagado
FROM huespedes hu
ORDER BY total_pagado DESC;

\echo '\n[5.4] Subconsulta comparada con un promedio: reservaciones más caras que el promedio'
SELECT codigo, total
FROM reservaciones
WHERE total > (SELECT AVG(total) FROM reservaciones WHERE estado <> 'cancelada')
ORDER BY total DESC;

\echo '\n[5.5] Subconsulta en el FROM (tabla derivada): ocupación de cada tipo de habitación'
SELECT tipo, noches_vendidas, habitaciones,
       ROUND(noches_vendidas::numeric / habitaciones, 1) AS noches_por_habitacion
FROM (SELECT t.nombre AS tipo,
             COUNT(DISTINCT h.id) AS habitaciones,
             COALESCE(SUM(r.noches) FILTER (WHERE r.estado IN ('check_in', 'check_out')), 0) AS noches_vendidas
      FROM tipos_habitacion t
      JOIN habitaciones h ON h.tipo_id = t.id
      LEFT JOIN reservaciones r ON r.habitacion_id = h.id
      GROUP BY t.nombre) AS por_tipo
ORDER BY noches_vendidas DESC;

\echo '\n[5.6] Subconsulta correlacionada: la reservación más reciente de cada huésped'
SELECT hu.nombre, r.codigo, r.fecha_entrada
FROM huespedes hu JOIN reservaciones r ON r.huesped_id = hu.id
WHERE r.fecha_entrada = (SELECT MAX(r2.fecha_entrada) FROM reservaciones r2 WHERE r2.huesped_id = hu.id)
ORDER BY r.fecha_entrada;


-- █████████████████████████████████████████████████████████████████████
-- 6. FUNCIONES NUMÉRICAS
-- █████████████████████████████████████████████████████████████████████

\echo '\n[6.1] Catálogo: ROUND, TRUNC, CEIL, FLOOR, ABS, MOD, POWER, SQRT con el mismo número'
SELECT 1234.5678                 AS numero,
       ROUND(1234.5678, 2)       AS "ROUND(2)",
       TRUNC(1234.5678, 2)       AS "TRUNC(2)",
       CEIL(1234.5678)           AS "CEIL",
       FLOOR(1234.5678)          AS "FLOOR",
       ABS(-1234.5678)           AS "ABS(-n)",
       MOD(1234, 100)            AS "MOD(1234,100)",
       POWER(2, 10)              AS "POWER(2,10)",
       ROUND(SQRT(1234.5678), 2) AS "SQRT";

\echo '\n[6.2] Desglose de impuestos: el precio ya incluye 16 % de IVA (ROUND al centavo)'
SELECT codigo, total,
       ROUND(total / 1.16, 2)           AS subtotal_sin_iva,
       ROUND(total - total / 1.16, 2)   AS iva_16
FROM reservaciones WHERE estado <> 'cancelada'
ORDER BY total DESC;

\echo '\n[6.3] Anticipo del 30 %: CEIL lo sube a la centena (más fácil de cobrar), FLOOR lo bajaría'
SELECT codigo, total,
       total * 0.30                       AS anticipo_exacto,
       CEIL(total * 0.30 / 100) * 100     AS "CEIL a la centena",
       FLOOR(total * 0.30 / 100) * 100    AS "FLOOR a la centena"
FROM reservaciones WHERE estado IN ('pendiente', 'confirmada');

\echo '\n[6.4] ABS y GREATEST/LEAST: diferencia entre la tarifa de temporada y el precio base'
SELECT t.nombre AS tipo, tt.nombre AS temporada, t.precio_base, tt.precio_noche AS precio_temporada,
       ABS(tt.precio_noche - t.precio_base)                                  AS diferencia,
       ROUND(100.0 * (tt.precio_noche - t.precio_base) / t.precio_base, 1)   AS "% de aumento",
       GREATEST(tt.precio_noche, t.precio_base)                              AS el_mayor
FROM tarifas_temporada tt JOIN tipos_habitacion t ON t.id = tt.tipo_id;

\echo '\n[6.5] MOD: número de habitación par/impar y piso calculado'
SELECT numero,
       CASE WHEN numero ~ '^\d+$' THEN MOD(numero::int, 2) END                AS "MOD(numero,2)",
       CASE WHEN numero ~ '^\d+$' THEN
         CASE MOD(numero::int, 2) WHEN 0 THEN 'Par' ELSE 'Impar' END END     AS par_impar,
       CASE WHEN numero ~ '^\d{3}$' THEN TRUNC(numero::int / 100) END         AS piso_por_numero
FROM habitaciones ORDER BY numero;

\echo '\n[6.6] Porcentaje de ocupación por hotel (ROUND de una división)'
SELECT hotel, total_habitaciones, ocupadas, porcentaje_ocupacion FROM v_ocupacion_hoy;


-- █████████████████████████████████████████████████████████████████████
-- 7. FUNCIONES DE MANIPULACIÓN DE CARACTERES
--    (más ejemplos en database/04_funciones_cadena.sql)
-- █████████████████████████████████████████████████████████████████████

\echo '\n[7.1] CONCAT, UPPER, LOWER, INITCAP, LENGTH'
SELECT CONCAT(nombre, ' ', apellidos)  AS nombre_completo,
       UPPER(apellidos)                AS mayusculas,
       LOWER(nombre)                   AS minusculas,
       INITCAP(UPPER(apellidos))       AS "INITCAP(MAYÚSCULAS)",
       LENGTH(apellidos)               AS letras_apellido
FROM huespedes ORDER BY apellidos LIMIT 5;

\echo '\n[7.2] SUBSTRING, LEFT, RIGHT, POSITION, SPLIT_PART: separar el correo y sacar iniciales'
SELECT email,
       SPLIT_PART(email::text, '@', 1)                         AS usuario,
       SUBSTRING(email::text FROM POSITION('@' IN email::text) + 1) AS dominio,
       CONCAT(LEFT(nombre, 1), LEFT(apellidos, 1))             AS iniciales,
       RIGHT(telefono, 4)                                      AS ultimos_4_del_telefono
FROM huespedes WHERE email IS NOT NULL;

\echo '\n[7.3] TRIM, REPLACE, REGEXP_REPLACE, LPAD: limpiar y dar formato'
SELECT '  (961) 123-45 67  '                                            AS capturado,
       TRIM('  (961) 123-45 67  ')                                      AS con_trim,
       REPLACE(REPLACE('961-123 45 67', '-', ''), ' ', '')             AS con_replace,
       REGEXP_REPLACE('(961) 123-45.67', '[^0-9]', '', 'g')            AS con_regexp,
       LPAD('42', 6, '0')                                               AS folio_con_ceros;

\echo '\n[7.4] REPEAT + RIGHT: ocultar el documento de identidad (protección de datos)'
SELECT nombre, tipo_documento,
       CONCAT(REPEAT('*', LENGTH(num_documento) - 4), RIGHT(num_documento, 4)) AS documento_oculto
FROM huespedes WHERE num_documento IS NOT NULL;

\echo '\n[7.5] TRANSLATE: quitar acentos para buscar "Martínez" escribiendo "martinez"'
SELECT nombre, apellidos
FROM huespedes
WHERE LOWER(TRANSLATE(apellidos, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE '%' || 'martinez' || '%';

\echo '\n[7.6] STRING_AGG: las habitaciones de cada piso en una sola línea'
SELECT h.piso, COUNT(*) AS cuartos, STRING_AGG(h.numero || ' (' || t.nombre || ')', ', ' ORDER BY h.numero) AS habitaciones
FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id
GROUP BY h.piso ORDER BY h.piso;


-- █████████████████████████████████████████████████████████████████████
-- 8. REGLAS DE PRECEDENCIA — en qué orden se evalúan los operadores
--    De mayor a menor prioridad:
--      1) paréntesis ( )
--      2) * / %   (multiplicación, división, módulo)
--      3) + -     (suma, resta)
--      4) || (concatenación de texto)
--      5) comparaciones  =  <>  <  >  <=  >=  LIKE  BETWEEN  IN  IS NULL
--      6) NOT
--      7) AND
--      8) OR
--    Regla práctica: si una condición mezcla AND y OR, SIEMPRE usar paréntesis.
-- █████████████████████████████████████████████████████████████████████

\echo '\n[8.1] Precedencia aritmética: * se hace antes que +'
SELECT 2 + 3 * 4       AS "2 + 3 * 4  (=14)",
       (2 + 3) * 4     AS "(2 + 3) * 4  (=20)",
       10 - 4 - 2      AS "10 - 4 - 2  (=4, de izquierda a derecha)",
       10 - (4 - 2)    AS "10 - (4 - 2)  (=8)";

\echo '\n[8.2] Precedencia en un cálculo real: total con descuento de $200 y 16 % de IVA'
SELECT 1100 * 3 - 200 * 1.16          AS "sin paréntesis (MAL: solo le pone IVA al descuento)",
       (1100 * 3 - 200) * 1.16        AS "con paréntesis (BIEN: IVA a todo)";

\echo '\n[8.3] División entera vs decimal: 7 / 2 con enteros da 3, no 3.5'
SELECT 7 / 2        AS "7 / 2 (enteros)",
       7 / 2.0      AS "7 / 2.0 (decimal)",
       7::numeric / 2 AS "CAST antes de dividir";

\echo '\n[8.4] AND se evalúa antes que OR — LA MISMA CONDICIÓN DA RESULTADOS DISTINTOS'
\echo '      Pregunta: "reservaciones pendientes o confirmadas EN EL PISO 2"'
\echo '      a) SIN paréntesis (incorrecto): se lee  pendiente  OR  (confirmada AND piso 2)'
SELECT r.codigo, r.estado, h.numero, h.piso
FROM reservaciones r JOIN habitaciones h ON h.id = r.habitacion_id
WHERE r.estado = 'pendiente' OR r.estado = 'confirmada' AND h.piso = 2
ORDER BY h.piso, h.numero;
\echo '      b) CON paréntesis (correcto): (pendiente OR confirmada) AND piso 2'
SELECT r.codigo, r.estado, h.numero, h.piso
FROM reservaciones r JOIN habitaciones h ON h.id = r.habitacion_id
WHERE (r.estado = 'pendiente' OR r.estado = 'confirmada') AND h.piso = 2
ORDER BY h.piso, h.numero;
\echo '      (La versión a) cuela la reservación pendiente de la habitación 101, que está en el piso 1)'

\echo '\n[8.5] NOT se evalúa antes que AND: "no canceladas y con saldo"'
SELECT s.codigo, r.estado, s.saldo
FROM v_saldo_reservaciones s JOIN reservaciones r ON r.id = s.id
WHERE NOT r.estado = 'cancelada' AND s.saldo > 0      -- se lee (NOT cancelada) AND saldo > 0
ORDER BY s.saldo DESC;

\echo '\n[8.6] Precedencia en las reglas del propio sistema (CHECK de RN-12 en 05_reglas_reservacion.sql):'
\echo '      CHECK (estado <> ''cancelada'' OR COALESCE(LENGTH(TRIM(motivo_cancelacion)), 0) >= 5)'
\echo '      Las comparaciones (<>, >=) se evalúan antes que OR, por eso no hacen falta más paréntesis.'
SELECT estado, motivo_cancelacion,
       estado <> 'cancelada' OR COALESCE(LENGTH(TRIM(motivo_cancelacion)), 0) >= 5 AS "¿cumple RN-12?"
FROM (VALUES ('confirmada', NULL),
             ('cancelada',  'Cambió de destino por trabajo'),
             ('cancelada',  NULL)) AS casos(estado, motivo_cancelacion);
