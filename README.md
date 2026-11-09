# 🏨 PMS — Hoteles Boutique y Posadas (Proyecto 9 · Turismo)

Sistema de administración hotelera: reservaciones, registro de huéspedes, asignación de cuartos y control de ocupación, para posadas y hoteles boutique de Tuxtla y San Cristóbal.

**Stack:** React (Vite) · Node.js (Express) · PostgreSQL · n8n · Node-RED · Telegram Bot · AWS (EC2 + RDS)
**Arquitectura:** Hexagonal (Puertos y Adaptadores)

---

## 1. Arranque rápido en Ubuntu

```bash
# Requisitos
sudo apt update && sudo apt install -y git curl tree
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# Base de datos (instala PostgreSQL, crea usuario/BD y tablas)
cd hotel-pms/database && ./setup_db.sh

# Backend
cd ../backend && cp .env.example .env && npm install
npm test          # pruebas del dominio (no necesitan BD)
npm run dev       # API en http://localhost:3000/api/health

# Frontend
cd .. && npm create vite@latest frontend -- --template react   # elige "Ignore files and continue"
cd frontend && npm install && npm run dev
```

> `crear_estructura.sh` genera solo las carpetas desde cero, por si quieres rehacer la estructura en otra ruta.

---

## 2. Arquitectura hexagonal

```
        ADAPTADORES DE ENTRADA                       ADAPTADORES DE SALIDA
   ┌──────────────────────────┐                ┌──────────────────────────────┐
   │ HTTP (Express routes)     │                │ PostgreSQL (repositorios)     │
   │ Telegram Bot (comandos)   │ ──► PUERTOS ──►│ Outbox → n8n / Node-RED       │
   │ Webhooks de n8n           │    ▲      │    │ Telegram (notificaciones)     │
   └──────────────────────────┘    │      ▼    └──────────────────────────────┘
                          ┌─────────────────────────┐
                          │  APLICACIÓN (casos uso) │
                          │  ┌───────────────────┐  │
                          │  │ DOMINIO (reglas)  │  │
                          │  └───────────────────┘  │
                          └─────────────────────────┘
```

**Regla de oro:** las dependencias apuntan hacia adentro. El dominio no importa Express, `pg` ni Telegram. Solo `shared/container.js` conecta adaptadores con puertos, así que puedes cambiar PostgreSQL local por RDS (o por un repositorio falso en pruebas) sin tocar las reglas de negocio.

### Estructura

```
hotel-pms/
├── backend/
│   ├── src/
│   │   ├── modules/                       # un módulo por contexto del negocio
│   │   │   ├── reservaciones/             # ← módulo de ejemplo ya implementado
│   │   │   │   ├── domain/
│   │   │   │   │   ├── entities/          # Reservacion.js
│   │   │   │   │   ├── value-objects/     # RangoFechas.js
│   │   │   │   │   ├── errors/            # ReservacionError.js
│   │   │   │   │   └── ports/             # ReservacionRepository.js, EventPublisher.js
│   │   │   │   ├── application/use-cases/ # CrearReservacion.js, ListarReservaciones.js
│   │   │   │   └── infrastructure/
│   │   │   │       ├── http/              # reservacion.routes.js   (adaptador entrada)
│   │   │   │       └── persistence/       # PostgresReservacionRepository.js (salida)
│   │   │   ├── hoteles/  habitaciones/  huespedes/
│   │   │   └── estancias/  pagos/  usuarios/   # misma estructura, por implementar
│   │   ├── shared/
│   │   │   ├── container.js               # inyección de dependencias
│   │   │   └── infrastructure/            # pool BD, config, outbox, middlewares
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/unit  tests/integration
│   └── package.json  .env.example
├── frontend/src/
│   ├── domain/models                      # tipos: Reservacion, Habitacion...
│   ├── application/{hooks,services}       # useReservaciones(), lógica de pantalla
│   ├── infrastructure/{api,storage}       # cliente HTTP (fetch/axios), token
│   └── ui/{components,pages,layouts,routes,styles}
├── automation/
│   ├── n8n/workflows                      # exporta aquí los .json de n8n
│   ├── node-red/flows                     # flows.json de Node-RED
│   └── telegram-bot/src
├── database/  01_schema.sql  02_seed.sql  setup_db.sh  migrations/
├── infra/{aws,nginx}
└── docs/{diagramas,investigacion}
```

Para crear un módulo nuevo copia el patrón de `reservaciones`: entidad → puerto → caso de uso → adaptador Postgres → rutas → registrarlo en `container.js`.

---

## 3. Base de datos

| # | Tabla | Para qué sirve |
|---|-------|----------------|
| 1 | `hoteles` | Cada posada u hotel boutique (soporta varios en un solo sistema) |
| 2 | `usuarios` | Personal con rol: admin, gerente, recepción, limpieza |
| 3 | `tipos_habitacion` | Sencilla, Doble, Suite… con capacidad, precio base y amenidades (JSONB) |
| 4 | `habitaciones` | Cuartos físicos y su estado (disponible, ocupada, limpieza, mantenimiento) |
| 5 | `tarifas_temporada` | Precios especiales por fechas (Semana Santa, Navidad) sin traslapes |
| 6 | `huespedes` | Datos del huésped, documento (INE/pasaporte), chat de Telegram |
| 7 | `reservaciones` | ★ Tabla central. Fechas, habitación asignada, total, estado y canal |
| 8 | `estancias` | Check-in / check-out reales y quién los hizo |
| 9 | `acompanantes` | Personas que llegan con el huésped |
| 10 | `pagos` | Anticipos y liquidaciones (efectivo, tarjeta, transferencia) |
| 11 | `historial_habitacion` | Bitácora automática de cambios de estado de cada cuarto |
| 12 | `eventos_dominio` | Outbox: eventos que consumen n8n y Node-RED |
| 13 | `notificaciones` | Mensajes enviados por el bot de Telegram y su resultado |

**Vistas y funciones:** `v_ocupacion_hoy` (porcentaje de ocupación por hotel), `v_saldo_reservaciones` (cuánto falta por pagar), `fn_habitaciones_disponibles(hotel, entrada, salida)`.

### 🛡️ Cómo se resuelve la sobreventa (el problema del proyecto)

La restricción `no_sobreventa` en `reservaciones` usa un `EXCLUDE USING gist` con rangos de fechas: PostgreSQL **rechaza** cualquier reservación activa cuyas fechas se encimen con otra en la misma habitación, aunque dos recepcionistas guarden al mismo tiempo. El rango es `[entrada, salida)`, así que alguien puede entrar el mismo día que otro sale.

Hay dos capas de protección: el caso de uso consulta disponibilidad primero (mensaje amigable) y la BD es la garantía final (el adaptador traduce el error `23P01` a HTTP 409).

### Relaciones

```
hoteles 1─N tipos_habitacion 1─N habitaciones
hoteles 1─N usuarios
huespedes 1─N reservaciones N─1 habitaciones
reservaciones 1─1 estancias 1─N acompanantes
reservaciones 1─N pagos
eventos_dominio 1─N notificaciones
```

---

## 4. Automatización (flujo sugerido)

1. El backend crea una reservación → inserta `reservacion.creada` en `eventos_dominio`.
2. **n8n** (nodo Postgres cada minuto, o webhook) lee eventos con `procesado = false`, envía la confirmación al huésped por **Telegram** y marca el evento como procesado.
3. **Node-RED** genera el reporte diario de ocupación (`v_ocupacion_hoy`) y avisa a recepción las llegadas del día.

## 5. Despliegue en AWS

- **RDS PostgreSQL:** ejecuta `01_schema.sql` con el usuario maestro (las extensiones `btree_gist`, `pgcrypto` y `citext` están permitidas en RDS).
- **EC2 (Ubuntu):** backend con `pm2`, frontend compilado (`npm run build`) servido por Nginx (`infra/nginx`), n8n y Node-RED en Docker.
