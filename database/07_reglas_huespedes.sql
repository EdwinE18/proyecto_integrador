-- =====================================================================
--  Reglas de HUÉSPEDES a nivel base de datos (segunda capa)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/07_reglas_huespedes.sql
--  Se puede ejecutar varias veces sin problema.
--
--  NOT VALID: la regla se aplica a todo lo que se inserte o edite desde
--  ahora, pero no revisa los registros viejos. Así, si ya había huéspedes
--  capturados sin contacto, la instalación no se rompe.
-- =====================================================================
SET client_min_messages = warning;

-- RN-32: al menos un medio de contacto (correo o teléfono)
ALTER TABLE huespedes DROP CONSTRAINT IF EXISTS rn32_contacto;
ALTER TABLE huespedes ADD CONSTRAINT rn32_contacto
  CHECK (COALESCE(NULLIF(trim(email::text), ''), NULLIF(trim(telefono), '')) IS NOT NULL) NOT VALID;

-- RN-33: tipo y número de documento van juntos (los dos o ninguno)
ALTER TABLE huespedes DROP CONSTRAINT IF EXISTS rn33_documento_completo;
ALTER TABLE huespedes ADD CONSTRAINT rn33_documento_completo
  CHECK ((tipo_documento IS NULL) = (num_documento IS NULL)) NOT VALID;
