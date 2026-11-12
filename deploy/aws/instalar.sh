#!/usr/bin/env bash
# =====================================================================
#  Instala el PMS completo en un servidor Ubuntu 24.04 (AWS EC2)
#
#     sudo bash deploy/aws/instalar.sh
#
#  Sirve para dos servidores (o uno solo con todo). Primero pregunta cuál es este:
#    1) BACKEND + BASE DE DATOS: PostgreSQL (aquí mismo, o AWS RDS), la API (Node.js,
#       servicio "pms-api", puerto 3000) y el bot del hotel con Node-RED (servicio "pms-bot":
#       conversación con huéspedes, resumen de las 8:00 y avisos por Telegram)
#    2) FRONTEND: la página web (React compilado) con nginx en el puerto 80;
#       nginx reenvía /api al backend por la red privada de AWS
#    3) TODO EN UNO: las dos cosas en el mismo servidor
#  Todo queda con arranque automático.
#
#  Se puede volver a correr: no borra datos. Para solo actualizar el código: actualizar.sh
#  Todas las respuestas se pueden dar por variables de entorno (ver PREGUNTAS abajo).
# =====================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"     # carpeta del repositorio
APP_USER=pms
WEB_DIR=/var/www/hotel-pms
NODE_RED_DIR=/home/$APP_USER/.node-red
CA_RDS=/etc/ssl/certs/rds-global-bundle.pem
SECRETOS=/root/pms-credenciales.txt
DB_NAME=hotel_pms
DB_USER=pms_admin

paso() { echo -e "\n\033[1;36m▶ $*\033[0m"; }
ok()   { echo -e "  \033[32m✔\033[0m $*"; }
aviso(){ echo -e "  \033[33m!\033[0m $*"; }
pregunta() {  # pregunta VARIABLE "texto" [valor_por_omision] [secreta]
  local var=$1 texto=$2 def=${3:-} secreta=${4:-} resp
  if [[ -n "${!var:-}" ]]; then return; fi          # ya viene en el entorno
  if [[ -n "$secreta" ]]; then read -rsp "  $texto: " resp; echo
  else read -rp "  $texto${def:+ [$def]}: " resp; fi
  printf -v "$var" '%s' "${resp:-$def}"
}

[[ $EUID -eq 0 ]] || { echo "Ejecútalo con sudo:  sudo bash $0"; exit 1; }
[[ -f "$APP_DIR/database/01_schema.sql" ]] || { echo "No encuentro el proyecto en $APP_DIR"; exit 1; }

# Respuestas guardadas de una instalación anterior (si existen)
# shellcheck disable=SC1090
[[ -f "$SECRETOS" ]] && source <(grep -E '^[A-Z_]+=' "$SECRETOS")

# ---------------------------------------------------------------------
paso "PREGUNTAS"
echo "  ¿Qué servidor es este?"
echo "    1) Backend + base de datos (API, PostgreSQL y bot)"
echo "    2) Frontend (página web con nginx)"
echo "    3) Todo en uno (un solo servidor)"
pregunta ROL "Elige 1, 2 o 3" "1"
[[ "$ROL" =~ ^[123]$ ]] || { echo "Opción inválida: $ROL"; exit 1; }
es_back()  { [[ "$ROL" == 1 || "$ROL" == 3 ]]; }
es_front() { [[ "$ROL" == 2 || "$ROL" == 3 ]]; }

DB_HOST=127.0.0.1; DB_SSL=false
if es_back; then
  echo "  ¿Dónde va la base de datos?"
  echo "    1) AWS RDS PostgreSQL (ya creada en la consola)"
  echo "    2) PostgreSQL en este mismo servidor"
  pregunta MODO_BD "Elige 1 o 2" "2"
  if [[ "$MODO_BD" == "1" ]]; then
    pregunta RDS_HOST "Endpoint de RDS (ej. hotel-pms-db.xxxx.us-east-1.rds.amazonaws.com)"
    pregunta RDS_ADMIN "Usuario maestro de RDS" "postgres"
    pregunta RDS_ADMIN_PASS "Contraseña maestra de RDS" "" secreta
    DB_HOST=$RDS_HOST; DB_SSL=true
  fi
  pregunta CARGAR_DEMO "¿Cargar datos de demostración (Posada Los Arcos)? s/n" "s"
fi
MODO_BD=${MODO_BD:-2}
if [[ "$ROL" == 2 ]]; then
  pregunta BACKEND_IP "IP PRIVADA del servidor backend (en EC2: Private IPv4, ej. 172.31.20.15)"
fi
pregunta BOT_USUARIO "Usuario del bot del hotel, sin @ (vacío = sin bot)" ""
if es_back && [[ -n "$BOT_USUARIO" ]]; then pregunta BOT_TOKEN "Token del bot (de @BotFather)" "" secreta; fi

# Secretos propios del sistema: se generan una vez y se reutilizan
DB_PASS=${DB_PASS:-$(openssl rand -hex 12)}
ASIS_PASS=${ASIS_PASS:-$(openssl rand -hex 12)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
# Se guardan desde ya: si algo falla a la mitad, al volver a correr se reutilizan
(umask 077
cat > "$SECRETOS" <<TXT
# Datos de la instalación del PMS (no compartir). Se reutilizan si vuelves a correr instalar.sh
ROL=$ROL
BACKEND_IP=${BACKEND_IP:-}
MODO_BD=$MODO_BD
RDS_HOST=${RDS_HOST:-}
RDS_ADMIN=${RDS_ADMIN:-}
DB_PASS=$DB_PASS
ASIS_PASS=$ASIS_PASS
JWT_SECRET=$JWT_SECRET
BOT_USUARIO=$BOT_USUARIO
CARGAR_DEMO=${CARGAR_DEMO:-s}
TXT
)

# ---------------------------------------------------------------------
paso "1/7 Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
PAQUETES=(curl ca-certificates git python3 openssl)
es_back  && PAQUETES+=(build-essential postgresql-client)
es_front && PAQUETES+=(nginx)
apt-get install -y -qq "${PAQUETES[@]}" >/dev/null
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node.js $(node -v) y ${PAQUETES[*]}"
if command -v timedatectl >/dev/null && timedatectl set-timezone America/Mexico_City 2>/dev/null; then
  ok "Zona horaria del servidor: America/Mexico_City"
fi
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if es_back; then
# ---------------------------------------------------------------------
paso "2/7 Base de datos"
if [[ "$MODO_BD" == "1" ]]; then
  # Certificado de Amazon para verificar la conexión cifrada con RDS
  curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o "$CA_RDS"
  ok "Certificado de RDS descargado"
  export PGSSLMODE=require
  ADMIN_PSQL=(psql "host=$DB_HOST port=5432 dbname=postgres user=$RDS_ADMIN" -v ON_ERROR_STOP=1 -q)
  export PGPASSWORD=$RDS_ADMIN_PASS
  "${ADMIN_PSQL[@]}" -c "SELECT 1" >/dev/null || { echo "No me pude conectar a RDS. Revisa endpoint, contraseña y grupo de seguridad (puerto 5432)."; exit 1; }
  ok "Conexión a RDS correcta"
else
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null
  systemctl enable --now postgresql 2>/dev/null || service postgresql start
  ADMIN_PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -q)
  ok "PostgreSQL $(psql --version | awk '{print $3}') instalado en este servidor"
fi

# Usuarios y base (solo si no existen)
"${ADMIN_PSQL[@]}" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'asistente_ro') THEN
    CREATE ROLE asistente_ro LOGIN PASSWORD '$ASIS_PASS';
  END IF;
END \$\$;
SQL
if [[ "$MODO_BD" == "1" ]]; then "${ADMIN_PSQL[@]}" -c "GRANT $DB_USER TO CURRENT_USER" 2>/dev/null || true; fi
if ! "${ADMIN_PSQL[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  "${ADMIN_PSQL[@]}" -c "CREATE DATABASE $DB_NAME OWNER $DB_USER"
  ok "Base $DB_NAME creada"
fi
"${ADMIN_PSQL[@]}" -c "GRANT CONNECT ON DATABASE $DB_NAME TO asistente_ro"
"${ADMIN_PSQL[@]}" -c "ALTER DATABASE $DB_NAME SET timezone TO 'America/Mexico_City'"
# Las extensiones las crea el administrador
if [[ "$MODO_BD" == "1" ]]; then
  psql "host=$DB_HOST dbname=$DB_NAME user=$RDS_ADMIN" -q -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS citext;"
else
  sudo -u postgres psql -d "$DB_NAME" -q -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS citext;"
fi

# Tablas, reglas y funciones (con el usuario de la aplicación)
export PGPASSWORD=$DB_PASS
APP_PSQL=(psql "host=$DB_HOST port=5432 dbname=$DB_NAME user=$DB_USER" -v ON_ERROR_STOP=1 -q)
cargar() { "${APP_PSQL[@]}" -f "$APP_DIR/database/$1" >/dev/null 2>"/tmp/pms-$1.log" || { echo "Falló $1:"; cat "/tmp/pms-$1.log"; exit 1; }; }
if "${APP_PSQL[@]}" -tAc "SELECT to_regclass('public.hoteles') IS NOT NULL" | grep -q t; then
  ok "Las tablas ya existían: se conservan los datos"
else
  cargar 01_schema.sql; ok "Tablas creadas"
  NUEVA=1
fi
for f in 04_funciones_cadena 05_reglas_reservacion 06_reglas_estancias_pagos 07_reglas_huespedes \
         08_reglas_usuarios 09_notificaciones 12_asistente 14_bot_huespedes; do
  cargar "$f.sql"
done
ok "Reglas, notificaciones, asistente y bot de huéspedes"
if [[ "${NUEVA:-}" == "1" && "$CARGAR_DEMO" =~ ^[sS] ]]; then
  cargar 02_seed.sql; cargar 10_datos_demo.sql
  ok "Datos de demostración cargados (usuarios con contraseña Demo1234)"
fi
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME?sslmode=$([[ $DB_SSL == true ]] && echo require || echo disable)" \
  python3 "$APP_DIR/scripts/esquema_compacto.py" >/dev/null && ok "Resumen de la base para la IA"
unset PGPASSWORD PGSSLMODE

# ---------------------------------------------------------------------
paso "3/7 API (backend)"
cat > "$APP_DIR/backend/.env" <<ENV
PORT=3000
DATABASE_URL=postgres://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME
DB_SSL=$DB_SSL
JWT_SECRET=$JWT_SECRET
ENV
chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"; chmod 600 "$APP_DIR/backend/.env"
sudo -u "$APP_USER" -H bash -c "export npm_config_cache=/home/$APP_USER/.npm; cd '$APP_DIR/backend' && npm ci --omit=dev --no-audit --no-fund --loglevel=error"
cat > /etc/systemd/system/pms-api.service <<UNIT
[Unit]
Description=PMS hotelero - API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/backend
Environment=NODE_ENV=production
$([[ $DB_SSL == true ]] && echo "Environment=NODE_EXTRA_CA_CERTS=$CA_RDS")
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
ok "Servicio pms-api"
fi   # fin de la parte del backend (pasos 2 y 3)

if es_front; then
# ---------------------------------------------------------------------
paso "4/7 Página web (frontend)"
echo "VITE_TELEGRAM_BOT=$BOT_USUARIO" > "$APP_DIR/frontend/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/frontend/.env"
sudo -u "$APP_USER" -H bash -c "export npm_config_cache=/home/$APP_USER/.npm; cd '$APP_DIR/frontend' && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent" >/dev/null
mkdir -p "$WEB_DIR"; rm -rf "${WEB_DIR:?}"/*; cp -r "$APP_DIR/frontend/dist/." "$WEB_DIR/"
ok "Compilada y copiada a $WEB_DIR"

# ---------------------------------------------------------------------
paso "5/7 nginx (puerto 80)"
# En el servidor de frontend, /api se reenvía a la IP privada del backend
API_DESTINO=$([[ "$ROL" == 2 ]] && echo "$BACKEND_IP" || echo 127.0.0.1)
sed "s#http://127.0.0.1:3000#http://$API_DESTINO:3000#" "$APP_DIR/deploy/aws/nginx-pms.conf" > /etc/nginx/sites-available/hotel-pms
ln -sf /etc/nginx/sites-available/hotel-pms /etc/nginx/sites-enabled/hotel-pms
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
ok "nginx: la web en /, la API en /api → $API_DESTINO:3000"
if [[ "$ROL" == 2 ]]; then
  if curl -s -m 5 "http://$BACKEND_IP:3000/api/health" | grep -q '"ok":true'; then ok "El backend responde en $BACKEND_IP:3000"
  else aviso "No pude llegar al backend en $BACKEND_IP:3000. Revisa que esté instalado y que su grupo de seguridad permita el puerto 3000 desde este servidor."; fi
fi
fi   # fin de la parte del frontend (pasos 4 y 5)

# ---------------------------------------------------------------------
if es_back; then
paso "6/7 Bot del hotel (Node-RED)"
if [[ -n "$BOT_USUARIO" && -n "${BOT_TOKEN:-}" ]]; then
  command -v node-red >/dev/null || npm install -g --unsafe-perm --no-audit --no-fund --loglevel=error node-red >/dev/null
  sudo -u "$APP_USER" -H bash -c "export npm_config_cache=/home/$APP_USER/.npm; mkdir -p '$NODE_RED_DIR' && cd '$NODE_RED_DIR' && \
    { [[ -f package.json ]] || echo '{\"name\":\"pms-node-red\",\"private\":true}' > package.json; } && \
    npm install --no-audit --no-fund --loglevel=error node-red-contrib-telegrambot node-red-contrib-postgresql >/dev/null"
  cat > "$NODE_RED_DIR/settings.js" <<'JS'
// Node-RED del PMS: el editor solo escucha en este servidor (no se publica a internet)
module.exports = {
  uiHost: '127.0.0.1',
  uiPort: 1880,
  flowFile: 'flows.json',
  credentialSecret: false,          // el token vive en flows_cred.json con permisos 600
  logging: { console: { level: 'info', metrics: false, audit: false } },
};
JS
  sudo -u "$APP_USER" BOT_TOKEN="$BOT_TOKEN" DB_SSL="$DB_SSL" \
    python3 "$APP_DIR/deploy/aws/preparar_node_red.py" "$NODE_RED_DIR" "$BOT_USUARIO"
  cat > /etc/systemd/system/pms-bot.service <<UNIT
[Unit]
Description=PMS hotelero - Bot de Telegram (Node-RED)
After=network-online.target pms-api.service
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$NODE_RED_DIR
Environment=PGHOST=$DB_HOST
Environment=PGPORT=5432
Environment=PGDATABASE=$DB_NAME
Environment=PGUSER=$DB_USER
Environment=PGPASSWORD=$DB_PASS
Environment=TZ=America/Mexico_City
$([[ $DB_SSL == true ]] && echo "Environment=NODE_EXTRA_CA_CERTS=$CA_RDS")
ExecStart=$(command -v node-red) --userDir $NODE_RED_DIR
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  chmod 600 /etc/systemd/system/pms-bot.service
  ok "Servicio pms-bot (@$BOT_USUARIO)"
else
  aviso "Sin bot: vuelve a correr este script cuando tengas el token de @BotFather"
fi
fi   # fin del bot (paso 6)

# ---------------------------------------------------------------------
paso "7/7 Arrancar servicios"
if command -v systemctl >/dev/null && [[ -d /run/systemd/system ]]; then
  systemctl daemon-reload
  if es_back; then
    systemctl enable --now pms-api >/dev/null 2>&1; systemctl restart pms-api
    [[ -f /etc/systemd/system/pms-bot.service ]] && { systemctl enable --now pms-bot >/dev/null 2>&1; systemctl restart pms-bot; }
  fi
  if es_front; then systemctl enable nginx >/dev/null 2>&1; systemctl reload-or-restart nginx; fi
  sleep 3
  if es_back; then
    if systemctl is-active --quiet pms-api; then ok "API funcionando"; else aviso "La API no arrancó: journalctl -u pms-api -n 50"; fi
    if [[ -f /etc/systemd/system/pms-bot.service ]]; then
      if systemctl is-active --quiet pms-bot; then ok "Bot funcionando"; else aviso "El bot no arrancó: journalctl -u pms-bot -n 50"; fi
    fi
  fi
else
  aviso "Este equipo no usa systemd: arranca a mano $(es_back && echo "node $APP_DIR/backend/src/server.js") $(es_front && echo nginx)"
fi

# IP pública (servicio de metadatos de EC2)
TOKEN_MD=$(curl -s -m 2 -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
IP=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $TOKEN_MD" http://169.254.169.254/latest/meta-data/public-ipv4 || true)
IP_PRIV=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $TOKEN_MD" http://169.254.169.254/latest/meta-data/local-ipv4 || true)
echo
if [[ "$ROL" == 1 ]]; then
  echo -e "\033[1;32m✅ Backend + base de datos instalados.\033[0m"
  echo "   IP PRIVADA de este servidor:  ${IP_PRIV:-<ver Private IPv4 en la consola de EC2>}"
  echo "   Úsala al instalar el servidor de FRONTEND (opción 2)."
  echo "   Ver registros:  journalctl -u pms-api -f   ·   journalctl -u pms-bot -f"
else
  echo -e "\033[1;32m✅ PMS instalado.\033[0m"
  echo "   Abre:  http://${IP:-<IP-pública-del-servidor>}"
  echo "   Usuarios de prueba (contraseña Demo1234): admin@pms.local · gerente@losarcos.mx · recepcion@losarcos.mx · limpieza@losarcos.mx"
fi
echo "   Contraseñas generadas guardadas en $SECRETOS (solo root)"
