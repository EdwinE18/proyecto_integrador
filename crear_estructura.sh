#!/usr/bin/env bash
# =====================================================================
#  Crea la estructura completa del PMS (arquitectura hexagonal) en Ubuntu
#  Uso:   chmod +x crear_estructura.sh && ./crear_estructura.sh [carpeta]
# =====================================================================
set -e
RAIZ="${1:-hotel-pms}"
mkdir -p "$RAIZ" && cd "$RAIZ"

# Módulos (bounded contexts) del sistema
MODULOS="hoteles habitaciones huespedes reservaciones estancias pagos usuarios"

# ---------------- BACKEND (Node.js · hexagonal) ----------------------
for m in $MODULOS; do
  mkdir -p backend/src/modules/$m/domain/{entities,value-objects,errors,ports}
  mkdir -p backend/src/modules/$m/application/use-cases
  mkdir -p backend/src/modules/$m/infrastructure/{http,persistence}
done
mkdir -p backend/src/shared/{domain,application,infrastructure/{database,http/middlewares,events,notifications,config}}
mkdir -p backend/tests/{unit,integration}

# ---------------- FRONTEND (React + Vite · hexagonal ligero) ---------
mkdir -p frontend/src/{domain/models,application/{hooks,services},infrastructure/{api,storage},ui/{components,pages,layouts,routes,styles}}

# ---------------- AUTOMATIZACIÓN ------------------------------------
mkdir -p automation/n8n/workflows automation/node-red/flows automation/telegram-bot/src

# ---------------- BASE DE DATOS / INFRA / DOCS -----------------------
mkdir -p database/migrations infra/aws infra/nginx docs/{diagramas,investigacion}

find . -type d -empty -exec touch {}/.gitkeep \;
echo "✅ Estructura creada en: $(pwd)"
command -v tree >/dev/null && tree -d -L 4 || find . -type d | sort
