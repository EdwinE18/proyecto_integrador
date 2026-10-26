-- =====================================================================
--  Reglas de USUARIOS a nivel base de datos (segunda capa)
--     psql -h localhost -U pms_admin -d hotel_pms -f database/08_reglas_usuarios.sql
--  Se puede ejecutar varias veces sin problema.
-- =====================================================================
SET client_min_messages = warning;

-- RN-71: jamás se guarda una contraseña en texto plano; solo hashes bcrypt ($2a$, $2b$, $2y$)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS rn71_password_es_hash;
ALTER TABLE usuarios ADD CONSTRAINT rn71_password_es_hash
  CHECK (password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$') NOT VALID;

-- RN-75: todo usuario que no es admin pertenece a un hotel
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS rn75_usuario_con_hotel;
ALTER TABLE usuarios ADD CONSTRAINT rn75_usuario_con_hotel
  CHECK (rol = 'admin' OR hotel_id IS NOT NULL) NOT VALID;
