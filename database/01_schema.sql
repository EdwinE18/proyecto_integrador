-- =====================================================================
--  PMS Hoteles Boutique y Posadas  —  Esquema PostgreSQL
--  Proyecto 9 · Área: Turismo (Tuxtla Gutiérrez / San Cristóbal)
--  Ejecutar conectado a la base "hotel_pms":
--     psql -U pms_admin -d hotel_pms -f 01_schema.sql
-- =====================================================================

BEGIN;

-- Extensiones -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- necesaria para la regla anti-sobreventa
CREATE EXTENSION IF NOT EXISTS citext;      -- emails sin distinguir mayúsculas

-- Tipos enumerados -------------------------------------------------------
CREATE TYPE rol_usuario        AS ENUM ('admin', 'gerente', 'recepcion', 'limpieza');
CREATE TYPE estado_habitacion  AS ENUM ('disponible', 'ocupada', 'limpieza', 'mantenimiento', 'fuera_servicio');
CREATE TYPE estado_reservacion AS ENUM ('pendiente', 'confirmada', 'check_in', 'check_out', 'cancelada', 'no_show');
CREATE TYPE canal_reservacion  AS ENUM ('mostrador', 'telefono', 'whatsapp', 'telegram', 'web', 'ota');
CREATE TYPE metodo_pago        AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'deposito');
CREATE TYPE estado_notificacion AS ENUM ('pendiente', 'enviada', 'fallida');

-- Función genérica para actualizar updated_at ----------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. HOTELES  (un sistema puede administrar varios hoteles/posadas)
-- =====================================================================
CREATE TABLE hoteles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(120) NOT NULL,
  tipo          VARCHAR(20)  NOT NULL DEFAULT 'boutique'
                CHECK (tipo IN ('boutique', 'posada')),
  rfc           VARCHAR(13),
  direccion     TEXT,
  ciudad        VARCHAR(80)  NOT NULL,           -- Tuxtla Gutiérrez, San Cristóbal...
  estado        VARCHAR(60)  NOT NULL DEFAULT 'Chiapas',
  telefono      VARCHAR(20),
  email         CITEXT,
  hora_check_in  TIME NOT NULL DEFAULT '15:00',
  hora_check_out TIME NOT NULL DEFAULT '12:00',
  telegram_chat_id VARCHAR(40),                  -- grupo de recepción para alertas
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. USUARIOS  (personal del hotel que usa el sistema)
-- =====================================================================
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID REFERENCES hoteles(id) ON DELETE RESTRICT,  -- NULL = admin global
  nombre        VARCHAR(80)  NOT NULL,
  apellidos     VARCHAR(120) NOT NULL,
  email         CITEXT       NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,           -- bcrypt desde Node.js
  rol           rol_usuario  NOT NULL DEFAULT 'recepcion',
  telegram_chat_id VARCHAR(40),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. TIPOS DE HABITACIÓN  (Sencilla, Doble, Suite...)
-- =====================================================================
CREATE TABLE tipos_habitacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
  nombre        VARCHAR(60)  NOT NULL,
  descripcion   TEXT,
  capacidad_adultos SMALLINT NOT NULL DEFAULT 2 CHECK (capacidad_adultos > 0),
  capacidad_ninos   SMALLINT NOT NULL DEFAULT 0 CHECK (capacidad_ninos >= 0),
  precio_base   NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0),   -- MXN por noche
  amenidades    JSONB NOT NULL DEFAULT '[]',     -- ["wifi","chimenea","vista"]
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, nombre)
);

-- =====================================================================
-- 4. HABITACIONES  (cuartos físicos)
-- =====================================================================
CREATE TABLE habitaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
  tipo_id       UUID NOT NULL REFERENCES tipos_habitacion(id) ON DELETE RESTRICT,
  numero        VARCHAR(10) NOT NULL,            -- "101", "Jade", "Cabaña 3"
  piso          SMALLINT,
  estado        estado_habitacion NOT NULL DEFAULT 'disponible',
  notas         TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, numero)
);

-- =====================================================================
-- 5. TARIFAS DE TEMPORADA  (precio especial por fechas: Semana Santa, etc.)
-- =====================================================================
CREATE TABLE tarifas_temporada (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id       UUID NOT NULL REFERENCES tipos_habitacion(id) ON DELETE CASCADE,
  nombre        VARCHAR(60) NOT NULL,            -- "Semana Santa 2027"
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  precio_noche  NUMERIC(10,2) NOT NULL CHECK (precio_noche >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin > fecha_inicio),
  -- No se permiten dos temporadas encimadas para el mismo tipo
  EXCLUDE USING gist (tipo_id WITH =, daterange(fecha_inicio, fecha_fin, '[)') WITH &&)
);

-- =====================================================================
-- 6. HUÉSPEDES
-- =====================================================================
CREATE TABLE huespedes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(80)  NOT NULL,
  apellidos     VARCHAR(120) NOT NULL,
  email         CITEXT,
  telefono      VARCHAR(20),
  tipo_documento VARCHAR(20) CHECK (tipo_documento IN ('INE', 'pasaporte', 'licencia', 'otro')),
  num_documento VARCHAR(40),
  nacionalidad  VARCHAR(60) DEFAULT 'Mexicana',
  fecha_nacimiento DATE,
  ciudad_origen VARCHAR(80),
  telegram_chat_id VARCHAR(40),                  -- para confirmaciones por bot
  notas         TEXT,                            -- preferencias, alergias...
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_documento, num_documento)
);

-- =====================================================================
-- 7. RESERVACIONES  ★ tabla central: aquí se evita la sobreventa ★
-- =====================================================================
CREATE TABLE reservaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(12) NOT NULL UNIQUE
                DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  hotel_id      UUID NOT NULL REFERENCES hoteles(id) ON DELETE RESTRICT,
  huesped_id    UUID NOT NULL REFERENCES huespedes(id) ON DELETE RESTRICT,
  habitacion_id UUID NOT NULL REFERENCES habitaciones(id) ON DELETE RESTRICT,
  fecha_entrada DATE NOT NULL,
  fecha_salida  DATE NOT NULL,
  noches        INTEGER GENERATED ALWAYS AS (fecha_salida - fecha_entrada) STORED,
  num_adultos   SMALLINT NOT NULL DEFAULT 1 CHECK (num_adultos > 0),
  num_ninos     SMALLINT NOT NULL DEFAULT 0 CHECK (num_ninos >= 0),
  precio_noche  NUMERIC(10,2) NOT NULL CHECK (precio_noche >= 0),
  total         NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  estado        estado_reservacion NOT NULL DEFAULT 'pendiente',
  canal         canal_reservacion  NOT NULL DEFAULT 'mostrador',
  solicitudes_especiales TEXT,
  motivo_cancelacion TEXT,
  creado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_salida > fecha_entrada),

  -- REGLA ANTI-SOBREVENTA:
  -- Una misma habitación no puede tener dos reservaciones activas con
  -- fechas que se encimen. La salida es exclusiva '[)': si alguien sale
  -- el día 10, otra persona puede entrar ese mismo día 10.
  CONSTRAINT no_sobreventa EXCLUDE USING gist (
    habitacion_id WITH =,
    daterange(fecha_entrada, fecha_salida, '[)') WITH &&
  ) WHERE (estado IN ('pendiente', 'confirmada', 'check_in'))
);

-- =====================================================================
-- 8. ESTANCIAS  (registro real de check-in / check-out)
-- =====================================================================
CREATE TABLE estancias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservacion_id   UUID NOT NULL UNIQUE REFERENCES reservaciones(id) ON DELETE CASCADE,
  check_in_real    TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_real   TIMESTAMPTZ,
  usuario_check_in  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_check_out UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  placas_vehiculo  VARCHAR(15),
  observaciones    TEXT,
  CHECK (check_out_real IS NULL OR check_out_real > check_in_real)
);

-- Acompañantes registrados en la estancia (opcional, para el libro de registro)
CREATE TABLE acompanantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estancia_id   UUID NOT NULL REFERENCES estancias(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(160) NOT NULL,
  es_menor      BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================================================================
-- 9. PAGOS  (anticipos, pagos parciales y liquidación)
-- =====================================================================
CREATE TABLE pagos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservacion_id UUID NOT NULL REFERENCES reservaciones(id) ON DELETE RESTRICT,
  monto         NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo        metodo_pago NOT NULL,
  referencia    VARCHAR(80),
  es_anticipo   BOOLEAN NOT NULL DEFAULT FALSE,
  registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_pago    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 10. HISTORIAL DE ESTADOS DE HABITACIÓN  (limpieza, mantenimiento)
-- =====================================================================
CREATE TABLE historial_habitacion (
  id            BIGSERIAL PRIMARY KEY,
  habitacion_id UUID NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
  estado_anterior estado_habitacion,
  estado_nuevo  estado_habitacion NOT NULL,
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  comentario    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 11. EVENTOS DE DOMINIO  (outbox: de aquí leen n8n y Node-RED)
--   El backend inserta un evento por cada cosa importante que pasa
--   (reservación creada, check-in, cancelación...). n8n/Node-RED los
--   consultan, ejecutan su flujo y los marcan como procesados.
-- =====================================================================
CREATE TABLE eventos_dominio (
  id            BIGSERIAL PRIMARY KEY,
  tipo          VARCHAR(60) NOT NULL,            -- 'reservacion.creada', 'estancia.check_in'
  agregado      VARCHAR(40) NOT NULL,            -- 'reservacion', 'habitacion'
  agregado_id   UUID NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  procesado     BOOLEAN NOT NULL DEFAULT FALSE,
  procesado_en  TIMESTAMPTZ,
  intentos      SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 12. NOTIFICACIONES  (bitácora de mensajes enviados por Telegram Bot)
-- =====================================================================
CREATE TABLE notificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal         VARCHAR(20) NOT NULL DEFAULT 'telegram',
  destinatario  VARCHAR(80) NOT NULL,            -- chat_id
  mensaje       TEXT NOT NULL,
  estado        estado_notificacion NOT NULL DEFAULT 'pendiente',
  error         TEXT,
  evento_id     BIGINT REFERENCES eventos_dominio(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_en    TIMESTAMPTZ
);

-- =====================================================================
-- ÍNDICES
-- =====================================================================
CREATE INDEX idx_usuarios_hotel         ON usuarios (hotel_id);
CREATE INDEX idx_habitaciones_hotel     ON habitaciones (hotel_id, estado);
CREATE INDEX idx_habitaciones_tipo      ON habitaciones (tipo_id);
CREATE INDEX idx_huespedes_nombre       ON huespedes (apellidos, nombre);
CREATE INDEX idx_huespedes_email        ON huespedes (email);
CREATE INDEX idx_reservaciones_hotel_fechas ON reservaciones (hotel_id, fecha_entrada, fecha_salida);
CREATE INDEX idx_reservaciones_huesped  ON reservaciones (huesped_id);
CREATE INDEX idx_reservaciones_estado   ON reservaciones (estado);
CREATE INDEX idx_pagos_reservacion      ON pagos (reservacion_id);
CREATE INDEX idx_eventos_pendientes     ON eventos_dominio (created_at) WHERE procesado = FALSE;
CREATE INDEX idx_historial_habitacion   ON historial_habitacion (habitacion_id, created_at DESC);

-- =====================================================================
-- TRIGGERS
-- =====================================================================
CREATE TRIGGER trg_hoteles_upd        BEFORE UPDATE ON hoteles          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_usuarios_upd       BEFORE UPDATE ON usuarios         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_tipos_upd          BEFORE UPDATE ON tipos_habitacion FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_habitaciones_upd   BEFORE UPDATE ON habitaciones     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_huespedes_upd      BEFORE UPDATE ON huespedes        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_reservaciones_upd  BEFORE UPDATE ON reservaciones    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Guarda automáticamente cada cambio de estado de una habitación
CREATE OR REPLACE FUNCTION fn_historial_habitacion() RETURNS trigger AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO historial_habitacion (habitacion_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_habitacion_historial
  AFTER UPDATE OF estado ON habitaciones
  FOR EACH ROW EXECUTE FUNCTION fn_historial_habitacion();

-- Reservación debe pertenecer al mismo hotel que la habitación
CREATE OR REPLACE FUNCTION fn_validar_hotel_reservacion() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM habitaciones
                 WHERE id = NEW.habitacion_id AND hotel_id = NEW.hotel_id) THEN
    RAISE EXCEPTION 'La habitación % no pertenece al hotel %', NEW.habitacion_id, NEW.hotel_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservacion_hotel
  BEFORE INSERT OR UPDATE OF habitacion_id, hotel_id ON reservaciones
  FOR EACH ROW EXECUTE FUNCTION fn_validar_hotel_reservacion();

-- =====================================================================
-- FUNCIONES Y VISTAS DE CONSULTA
-- =====================================================================

-- Habitaciones libres de un hotel en un rango de fechas
CREATE OR REPLACE FUNCTION fn_habitaciones_disponibles(
  p_hotel_id UUID, p_entrada DATE, p_salida DATE
) RETURNS TABLE (
  habitacion_id UUID, numero VARCHAR, tipo VARCHAR, precio_base NUMERIC, capacidad SMALLINT
) AS $$
  SELECT h.id, h.numero, t.nombre, t.precio_base, t.capacidad_adultos
  FROM habitaciones h
  JOIN tipos_habitacion t ON t.id = h.tipo_id
  WHERE h.hotel_id = p_hotel_id
    AND h.activo
    AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
    AND NOT EXISTS (
      SELECT 1 FROM reservaciones r
      WHERE r.habitacion_id = h.id
        AND r.estado IN ('pendiente', 'confirmada', 'check_in')
        AND daterange(r.fecha_entrada, r.fecha_salida, '[)')
            && daterange(p_entrada, p_salida, '[)')
    )
  ORDER BY h.numero;
$$ LANGUAGE sql STABLE;

-- Ocupación de hoy por hotel (para el dashboard)
CREATE OR REPLACE VIEW v_ocupacion_hoy AS
SELECT
  ho.id   AS hotel_id,
  ho.nombre AS hotel,
  COUNT(h.id) FILTER (WHERE h.activo)                       AS total_habitaciones,
  COUNT(r.id)                                               AS ocupadas,
  ROUND(100.0 * COUNT(r.id) / NULLIF(COUNT(h.id) FILTER (WHERE h.activo), 0), 1) AS porcentaje_ocupacion
FROM hoteles ho
JOIN habitaciones h ON h.hotel_id = ho.id
LEFT JOIN reservaciones r
       ON r.habitacion_id = h.id
      AND r.estado IN ('confirmada', 'check_in')
      AND CURRENT_DATE >= r.fecha_entrada AND CURRENT_DATE < r.fecha_salida
GROUP BY ho.id, ho.nombre;

-- Saldo pendiente por reservación
CREATE OR REPLACE VIEW v_saldo_reservaciones AS
SELECT
  r.id, r.codigo, r.total,
  COALESCE(SUM(p.monto), 0)           AS pagado,
  r.total - COALESCE(SUM(p.monto), 0) AS saldo
FROM reservaciones r
LEFT JOIN pagos p ON p.reservacion_id = r.id
GROUP BY r.id;

COMMIT;
