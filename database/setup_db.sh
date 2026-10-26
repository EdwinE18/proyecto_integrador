#!/usr/bin/env bash
# =====================================================================
#  Instala PostgreSQL en Ubuntu, crea usuario + base y carga el esquema
#  Uso:   chmod +x setup_db.sh && ./setup_db.sh
# =====================================================================
set -e
DB_NAME="hotel_pms"
DB_USER="pms_admin"
DB_PASS="${DB_PASS:-PI123}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v psql >/dev/null; then
  echo "▶ Instalando PostgreSQL..."
  sudo apt update && sudo apt install -y postgresql postgresql-contrib
fi
# En WSL no siempre hay systemctl: si falla, se usa service
sudo systemctl enable --now postgresql 2>/dev/null || sudo service postgresql start

echo "▶ Creando usuario y base de datos..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

# Las extensiones requieren superusuario
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS citext;"

echo "▶ Creando tablas..."
PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$DIR/01_schema.sql"

echo "▶ Aplicando funciones de cadena y reglas de reservación..."
PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$DIR/04_funciones_cadena.sql" >/dev/null
PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$DIR/05_reglas_reservacion.sql"

read -rp "¿Cargar datos de prueba? (s/n) " R
[[ "$R" == "s" ]] && PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$DIR/02_seed.sql"

echo "✅ Listo. Conéctate con:  psql -h localhost -U $DB_USER -d $DB_NAME"
echo "   DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
