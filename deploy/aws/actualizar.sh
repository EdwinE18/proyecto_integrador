#!/usr/bin/env bash
# =====================================================================
#  Actualiza el PMS en el servidor después de un  git push  desde tu computadora
#     cd /opt/hotel-pms && sudo bash deploy/aws/actualizar.sh
#  Baja el código nuevo, vuelve a cargar funciones y reglas (sin borrar datos),
#  recompila la página y reinicia los servicios.
# =====================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
[[ $EUID -eq 0 ]] || { echo "Ejecútalo con sudo:  sudo bash $0"; exit 1; }

echo "▶ Bajando cambios de GitHub"
git config --global --add safe.directory "$APP_DIR"
git -C "$APP_DIR" pull --ff-only

echo "▶ Reinstalando (conserva base de datos, contraseñas y token)"
# instalar.sh reutiliza las respuestas guardadas en /root/pms-credenciales.txt;
# solo vuelve a preguntar la contraseña maestra de RDS y el token del bot.
bash "$APP_DIR/deploy/aws/instalar.sh"
