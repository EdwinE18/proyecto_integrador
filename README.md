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

# Frontend (en OTRA terminal, con el backend corriendo)
cd frontend && npm install
npm run dev       # abre http://localhost:5173  (usuarios de prueba abajo, contraseña Demo1234)
```

El frontend reenvía todo lo que empieza con `/api` al backend en el puerto 3000 (configurado en `frontend/vite.config.js`), así que no hay problemas de CORS.

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
│   │   │   │   │   ├── entities/          # Reservacion.js (ciclo de vida completo)
│   │   │   │   │   ├── value-objects/     # RangoFechas.js
│   │   │   │   │   ├── errors/            # ReservacionError.js
│   │   │   │   │   └── ports/             # ReservacionRepository, HabitacionReader, Reloj, EventPublisher
│   │   │   │   ├── application/use-cases/ # Crear, Listar, Obtener, Confirmar, Cancelar
│   │   │   │   └── infrastructure/
│   │   │   │       ├── http/              # reservacion.routes.js   (adaptador entrada)
│   │   │   │       └── persistence/       # PostgresReservacionRepository.js (salida)
│   │   │   ├── pagos/                     # ✅ Dinero (centavos), Pago, CuentaReservacion
│   │   │   ├── estancias/                 # ✅ Estancia, check-in y check-out (transacciones)
│   │   │   ├── huespedes/                 # ✅ Huesped (normaliza y valida), búsqueda
│   │   │   ├── habitaciones/              # ✅ Habitacion (estados RN-24), disponibilidad con precio
│   │   │   ├── hoteles/                   # ✅ Lista de hoteles con ocupación del día
│   │   │   ├── explorador/                # ✅ Página para ver la BD
│   │   │   └── usuarios/                  # ✅ Login (JWT + bcrypt), permisos por rol, bloqueo de intentos
│   │   ├── shared/
│   │   │   ├── container.js               # inyección de dependencias
│   │   │   └── infrastructure/            # pool BD, config, outbox, middlewares
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/unit  tests/integration
│   └── package.json  .env.example
├── frontend/src/                          # React + Vite (hexagonal ligero)
│   ├── domain/                            # estados.js (textos, colores, cambios válidos), formato.js (dinero, fechas)
│   ├── application/                       # SesionContext (usuario, permisos, hotel) · hooks useConsulta / useAccion
│   ├── infrastructure/
│   │   ├── api/                           # cliente.js (fetch + token) · pmsApi.js (todas las rutas)
│   │   └── storage/                       # sesión en sessionStorage
│   └── ui/
│       ├── pages/                         # Login, Tablero, NuevaReservacion, Reservaciones, DetalleReservacion,
│       │                                  # Habitaciones, Huespedes, Usuarios, MiCuenta
│       ├── components/                    # Aviso (muestra la regla RN-xx), Modal, FormHuesped, check-in/cobro/cancelar
│       ├── layouts/AppLayout.jsx          # menú lateral: cada opción aparece solo si el rol tiene permiso
│       └── styles/global.css
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

## Inicio de sesión

Toda la API pide sesión (excepto el login). Usuarios de prueba (contraseña `Demo1234`):

| Correo | Rol | Hotel |
|---|---|---|
| `admin@pms.local` | admin general | todos |
| `recepcion@losarcos.mx` | recepción | Posada Los Arcos |
| `limpieza@losarcos.mx` | limpieza | Posada Los Arcos |
| `gerente@boutiquecanon.mx` | gerente | Hotel Boutique Cañón |

```bash
# 1. Iniciar sesión y guardar el token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"recepcion@losarcos.mx","password":"Demo1234"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

# 2. Mandarlo en cada petición
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/hoteles
```

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/auth/login` | `{ "email", "password" }` → `{ token, expiraEn, usuario: { rol, permisos, ... } }` |
| `GET` | `/api/auth/yo` | Usuario de la sesión actual |
| `POST` | `/api/auth/password` | Cambiar mi contraseña: `{ "actual", "nueva" }` |
| `GET` / `POST` | `/api/usuarios` | Listar / crear usuarios (solo admin) |

Respuestas de seguridad: **401** sin sesión o sesión vencida (RN-71) · **403** sin permiso para esa acción (RN-72) o de otro hotel (RN-75) · **429** demasiados intentos (RN-74).

> ⚠️ Antes de subir a AWS cambia `JWT_SECRET` en `backend/.env` por uno propio: `openssl rand -hex 32`

---

## API

Todas las respuestas son JSON. Cuando se rompe una regla de negocio, la respuesta incluye el campo `"regla"` (por ejemplo `"RN-11"`), que se busca en `docs/REGLAS_DE_NEGOCIO.md`.

| Método | Ruta | Qué hace | Reglas |
|---|---|---|---|
| `POST` | `/api/reservaciones` | Crea una reservación (queda `pendiente`). **El precio lo calcula el sistema** | RN-01, 04, 05, 08, 11, 13, 14, 61 |
| `GET` | `/api/reservaciones?hotelId=&desde=&hasta=` | Lista las reservaciones de un hotel en un rango de fechas | — |
| `GET` | `/api/reservaciones/:id` | Consulta una reservación | — |
| `PATCH` | `/api/reservaciones/:id/confirmar` | `pendiente → confirmada` | RN-09 |
| `PATCH` | `/api/reservaciones/:id/cancelar` | Cancela. Cuerpo: `{ "motivo": "..." }` | RN-10, RN-12 |
| `GET` | `/api/reservaciones/:id/pagos` | Estado de cuenta: total, pagado, saldo y pagos | RN-51 |
| `POST` | `/api/reservaciones/:id/pagos` | Registra un pago. Cuerpo: `{ "monto", "metodo", "referencia"?, "esAnticipo"? }` | RN-50, 54, 55, 56 |
| `POST` | `/api/reservaciones/:id/check-in` | Llegada del huésped. Cuerpo opcional: `{ "placas", "observaciones" }` | RN-42, 44, 45, 46 |
| `POST` | `/api/reservaciones/:id/check-out` | Salida del huésped (el cuarto pasa a limpieza) | RN-43, 52 |
| `GET` | `/api/hoteles` | Hoteles con su ocupación de hoy | — |
| `GET` | `/api/hoteles/:hotelId/habitaciones` | Habitaciones del hotel con estado, tipo y precio base | — |
| `GET` | `/api/hoteles/:hotelId/disponibilidad?entrada=&salida=&adultos=&ninos=` | Cuartos libres con total y desglose por noche | RN-01, 11, 13, 14, 61 |
| `GET` | `/api/hoteles/:hotelId/agenda?desde=&hasta=&estados=` | Reservaciones con huésped, cuarto y saldo (para el tablero) | — |
| `GET` | `/api/reservaciones/:id/detalle` | Reservación con huésped, cuarto, saldo y estancia | — |
| `PATCH` | `/api/habitaciones/:id/estado` | Cambia el estado. Cuerpo: `{ "estado", "comentario"? }` | RN-24, 25 |
| `GET` | `/api/huespedes?q=texto` | Busca por nombre, correo, teléfono o documento | — |
| `POST` | `/api/huespedes` | Registra un huésped | RN-30 a RN-33 |
| `GET` | `/api/huespedes/:id` | Consulta un huésped (documento oculto) | RN-34 |
| `PATCH` | `/api/huespedes/:id` | Edita los datos de un huésped | RN-31 a RN-33 |
| `GET` | `/api/explorador/tablas` | Lista las tablas de la BD (página en `http://localhost:3000`) | — |

Ejemplo:
```bash
curl -X POST http://localhost:3000/api/reservaciones -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "hotelId": "11111111-1111-1111-1111-111111111111",
  "huespedId": "b0000000-0000-0000-0000-000000000001",
  "habitacionId": "<id de una habitación>",
  "entrada": "2026-12-20", "salida": "2026-12-22",
  "numAdultos": 2, "numNinos": 0
}'
```

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
