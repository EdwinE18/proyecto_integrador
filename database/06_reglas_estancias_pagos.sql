-- =====================================================================
--  Reglas de PAGOS y ESTANCIAS a nivel base de datos (segunda capa)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/06_reglas_estancias_pagos.sql
--  Se puede ejecutar varias veces sin problema.
-- =====================================================================
SET client_min_messages = warning;

-- ---------------------------------------------------------------------
-- PAGOS
--   RN-55: solo se cobra a reservaciones pendientes, confirmadas o en check-in
--   RN-54: la suma de pagos nunca supera el total
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reglas_pago() RETURNS trigger AS $$
DECLARE
  r RECORD;
  pagado NUMERIC;
BEGIN
  -- FOR UPDATE "bloquea" la reservación: si dos recepcionistas cobran al mismo
  -- tiempo, el segundo espera a que termine el primero y ve su pago en la suma.
  SELECT estado, total INTO r FROM reservaciones WHERE id = NEW.reservacion_id FOR UPDATE;

  IF r.estado NOT IN ('pendiente', 'confirmada', 'check_in') THEN
    RAISE EXCEPTION 'RN-55: No se pueden registrar pagos en una reservación %', r.estado
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO pagado FROM pagos WHERE reservacion_id = NEW.reservacion_id;
  IF pagado + NEW.monto > r.total THEN
    RAISE EXCEPTION 'RN-54: El pago ($%) es mayor que el saldo pendiente ($%)', NEW.monto, r.total - pagado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reglas_pago ON pagos;
CREATE TRIGGER trg_reglas_pago
  BEFORE INSERT ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_reglas_pago();

-- ---------------------------------------------------------------------
-- ESTANCIAS: transiciones de estado de la reservación
--   RN-42: a check_in solo desde confirmada
--   RN-43: a check_out solo desde check_in
--   RN-52: a check_out solo con saldo en cero
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reglas_estancia() RETURNS trigger AS $$
DECLARE
  pagado NUMERIC;
BEGIN
  IF NEW.estado = 'check_in' AND OLD.estado <> 'confirmada' THEN
    RAISE EXCEPTION 'RN-42: Solo se hace check-in de reservaciones confirmadas (esta está %)', OLD.estado
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado = 'check_out' THEN
    IF OLD.estado <> 'check_in' THEN
      RAISE EXCEPTION 'RN-43: Solo se hace check-out de una estancia en curso (esta está %)', OLD.estado
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(SUM(monto), 0) INTO pagado FROM pagos WHERE reservacion_id = NEW.id;
    IF pagado < NEW.total THEN
      RAISE EXCEPTION 'RN-52: No se puede hacer check-out: falta pagar $%', NEW.total - pagado
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reglas_estancia ON reservaciones;
CREATE TRIGGER trg_reglas_estancia
  BEFORE UPDATE OF estado ON reservaciones
  FOR EACH ROW
  WHEN (NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado IN ('check_in', 'check_out'))
  EXECUTE FUNCTION fn_reglas_estancia();

-- Vista de apoyo: quién está hospedado ahora mismo (para el tablero de recepción)
CREATE OR REPLACE VIEW v_huespedes_en_casa AS
SELECT ho.nombre                          AS hotel,
       hab.numero                         AS habitacion,
       CONCAT(hu.nombre, ' ', hu.apellidos) AS huesped,
       r.codigo,
       e.check_in_real,
       r.fecha_salida                     AS salida_prevista,
       s.saldo
FROM estancias e
JOIN reservaciones r ON r.id = e.reservacion_id
JOIN huespedes hu    ON hu.id = r.huesped_id
JOIN habitaciones hab ON hab.id = r.habitacion_id
JOIN hoteles ho      ON ho.id = r.hotel_id
JOIN v_saldo_reservaciones s ON s.id = r.id
WHERE e.check_out_real IS NULL;
