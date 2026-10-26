-- =====================================================================
--  Reglas RN-11 y RN-13 a nivel base de datos (segunda capa de protección)
--  El backend ya las valida con mensajes claros; aquí PostgreSQL las
--  garantiza aunque alguien inserte datos sin pasar por el backend.
--
--  Se puede ejecutar varias veces sin problema:
--     psql -h localhost -U pms_admin -d hotel_pms -f database/05_reglas_reservacion.sql
--
--  RN-14 (no fechas pasadas) NO va aquí a propósito: impediría cargar
--  reservaciones históricas cuando un hotel migre sus agendas en papel.
--  Esa regla vive solo en el caso de uso CrearReservacion.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_validar_reglas_reservacion() RETURNS trigger AS $$
DECLARE
  hab RECORD;
BEGIN
  SELECT h.numero, h.estado, h.activo, t.capacidad_adultos, t.capacidad_ninos
    INTO hab
  FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id
  WHERE h.id = NEW.habitacion_id;

  -- RN-11: no más huéspedes de los que caben
  IF NEW.num_adultos > hab.capacidad_adultos OR NEW.num_ninos > hab.capacidad_ninos THEN
    RAISE EXCEPTION 'RN-11: La habitación % admite máximo % adulto(s) y % niño(s)',
      hab.numero, hab.capacidad_adultos, hab.capacidad_ninos
      USING ERRCODE = 'check_violation';
  END IF;

  -- RN-13: no reservar habitaciones en mantenimiento, fuera de servicio o dadas de baja.
  -- Solo al crear o al cambiar de habitación: si un cuarto entra a mantenimiento,
  -- las reservaciones que ya tenía se pueden seguir editando (para reubicarlas).
  IF TG_OP = 'INSERT' OR NEW.habitacion_id IS DISTINCT FROM OLD.habitacion_id THEN
    IF NOT hab.activo OR hab.estado IN ('mantenimiento', 'fuera_servicio') THEN
      RAISE EXCEPTION 'RN-13: La habitación % no se puede reservar (estado: %)',
        hab.numero, CASE WHEN hab.activo THEN hab.estado::text ELSE 'dada de baja' END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SET client_min_messages = warning;  -- oculta el aviso "does not exist, skipping"
DROP TRIGGER IF EXISTS trg_reglas_reservacion ON reservaciones;
CREATE TRIGGER trg_reglas_reservacion
  BEFORE INSERT OR UPDATE OF habitacion_id, num_adultos, num_ninos ON reservaciones
  FOR EACH ROW EXECUTE FUNCTION fn_validar_reglas_reservacion();
