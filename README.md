# 🏨 PMS — Hoteles Boutique y Posadas (Proyecto 9 · Turismo)

Sistema de administración hotelera: reservaciones, registro de huéspedes, asignación de cuartos y control de ocupación, para posadas y hoteles boutique de Tuxtla y San Cristóbal.

**Stack:** React (Vite) · Node.js (Express) · PostgreSQL · n8n · Node-RED · Telegram Bot · Ejecución local (Ubuntu / WSL)
**Arquitectura:** Hexagonal (Puertos y Adaptadores) en el backend · Basada en componentes en el frontend

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

**Regla de oro:** las dependencias apuntan hacia adentro. El dominio no importa Express, `pg` ni Telegram. Solo `shared/container.js` conecta adaptadores con puertos, así que puedes cambiar PostgreSQL local por una base en la nube (o por un repositorio falso en pruebas) sin tocar las reglas de negocio.

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
│   │   │   ├── hoteles/                   # ✅ Hoteles con ocupación del día y su configuración (RN-79)
│   │   │   ├── tarifas/                   # ✅ Temporada, precio base, historial de temporadas (RN-62, 63)
│   │   │   ├── reportes/                  # ✅ Indicadores: ocupación, ADR, RevPAR, cobranza (RN-78)
│   │   │   ├── explorador/                # ✅ Página para ver la BD
│   │   │   └── usuarios/                  # ✅ Login (JWT + bcrypt), permisos por rol, personal (RN-76, 77)
│   │   ├── shared/
│   │   │   ├── container.js               # inyección de dependencias
│   │   │   └── infrastructure/            # pool BD, config, outbox, middlewares
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/unit  tests/integration
│   └── package.json  .env.example
├── frontend/src/                          # React + Vite · ARQUITECTURA DE COMPONENTES
│   ├── components/                        # Reutilizables: base (Boton, Campo, Modal, Aviso, Chip)
│   │                                      # y compuestos (FormHuesped, ModalCheckIn, ModalPago, ModalCancelar)
│   ├── layouts/AppLayout.jsx              # Marco de la app: menú lateral según el rol
│   ├── pages/                             # Pantallas: Login, Tablero, NuevaReservacion, Reservaciones,
│   │                                      # DetalleReservacion, Habitaciones, Huespedes, MiCuenta
│   │                                      # y de administración: Reportes, Configuracion, Usuarios, Explorador
│   ├── hooks/                             # Lógica reutilizable: useConsulta (cargar datos), useAccion (guardar)
│   ├── context/SesionContext.jsx          # Usuario, permisos y hotel elegido, para toda la app
│   ├── services/                          # Comunicación con el backend: pmsApi, cliente HTTP, sesión
│   ├── utils/                             # estados.js (textos y colores), formato.js (dinero y fechas)
│   ├── styles/global.css
│   └── App.jsx                            # Rutas: cada página pide su permiso
├── automation/                            # ✅ Telegram (guía paso a paso en automation/README.md)
│   ├── n8n/notificaciones-telegram.json   # Envía los avisos pendientes cada minuto
│   ├── n8n/asistente-personal.json        # Asistente con IA para recepción, gerencia y admin
│   └── node-red/flows.json                # Bot que conversa + resumen diario a las 8:00
├── scripts/esquema_compacto.py            # Resume la BD para la IA (≈ 650 tokens en vez de ≈ 17,000)
├── database/  01_schema.sql … 12_asistente.sql  setup_db.sh
└── docs/{diagramas,investigacion}
```

Para crear un módulo nuevo copia el patrón de `reservaciones`: entidad → puerto → caso de uso → adaptador Postgres → rutas → registrarlo en `container.js`.

---

## Inicio de sesión

Los datos de prueba son de **Posada Los Arcos** (San Cristóbal): 12 habitaciones en 3 pisos (sencillas, dobles con chimenea, familiares y suites con terraza). El sistema admite más hoteles: cada uno vería solo lo suyo (RN-75).

Toda la API pide sesión (excepto el login). Usuarios de prueba (contraseña `Demo1234`):

| Correo | Rol | Hotel |
|---|---|---|
| `admin@pms.local` | admin general | todos |
| `recepcion@losarcos.mx` | recepción | Posada Los Arcos |
| `limpieza@losarcos.mx` | limpieza | Posada Los Arcos |
| `gerente@losarcos.mx` | gerente | Posada Los Arcos |

**Qué ve cada rol en el menú:**

| Pantalla | admin | gerente | recepción | limpieza |
|---|---|---|---|---|
| Tablero, Nueva reservación, Reservaciones, Huéspedes | ✔ | ✔ | ✔ | — |
| Habitaciones | ✔ | ✔ | ✔ | ✔ (abre en "Por limpiar") |
| Reportes (ocupación, ADR, RevPAR, cobranza) | ✔ | ✔ | — | — |
| Hotel y tarifas (datos del hotel, precios, temporadas) | ✔ | ✔ | — | — |
| Personal | ✔ todos | ✔ recepción y limpieza | — | — |
| Base de datos (explorador) | ✔ | — | — | — |

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
| `GET` / `POST` | `/api/usuarios` | Listar / crear usuarios (admin; gerente solo recepción y limpieza) |
| `PATCH` | `/api/usuarios/:id` | Editar nombre, rol, hotel, `activo` y `telegramChatId` (RN-76, 77) |
| `POST` | `/api/usuarios/:id/password` | Asignar contraseña nueva a alguien del personal (RN-73, 76, 77) |

Respuestas de seguridad: **401** sin sesión o sesión vencida (RN-71) · **403** sin permiso para esa acción (RN-72) o de otro hotel (RN-75) · **429** demasiados intentos (RN-74).

> ⚠️ Antes de usarlo en un hotel real cambia `JWT_SECRET` en `backend/.env` por uno propio: `openssl rand -hex 32`

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
| `PATCH` | `/api/hoteles/:hotelId` | Teléfono, correo, dirección, horarios y chat de Telegram (admin, gerente) | RN-79 |
| `GET` | `/api/hoteles/:hotelId/tarifas` | Tipos de habitación con precio base y temporadas (admin, gerente) | — |
| `PATCH` | `/api/hoteles/:hotelId/tarifas/tipos/:tipoId` | Cambia el precio base: `{ "precioBase" }` | RN-62 |
| `POST` | `/api/hoteles/:hotelId/tarifas/temporadas` | Crea temporada: `{ "tipoId", "nombre", "fechaInicio", "fechaFin", "precioNoche" }` | RN-60, 62, 63 |
| `DELETE` | `/api/hoteles/:hotelId/tarifas/temporadas/:id` | Elimina una temporada que todavía no empieza | RN-63 |
| `GET` | `/api/hoteles/:hotelId/reportes?desde=&hasta=` | Ocupación, ADR, RevPAR, cobrado, canales y cancelaciones (admin, gerente) | RN-78 |
| `GET` | `/api/explorador/tablas` | Lista las tablas de la BD (pantalla *Base de datos*, solo admin) | — |

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

### Consultas para la evaluación de Base de Datos

`database/11_consultas_evaluacion.sql` reúne, sobre las tablas reales del hotel, un ejemplo de cada tema evaluado (cada consulta tiene un número para ubicarla rápido):

| Tema | Consultas | Qué muestra |
|---|---|---|
| 1. Selección | 1.1 – 1.5 | `WHERE` con comparación, `IN`, `BETWEEN`, `ILIKE`, `IS NULL` |
| 2. Proyección | 2.1 – 2.4 | Columnas específicas, alias, columnas calculadas, `DISTINCT` |
| 3. UNION | 3.1 – 3.4 | Llegadas + salidas de hoy, directorio de contactos, `UNION` vs `UNION ALL`, estado de cuenta |
| 4. Funciones | 4.1 – 4.6 | Agregación con `GROUP BY` y `HAVING`, fechas, `COALESCE`/`NULLIF`/`CAST`, funciones PL/pgSQL propias |
| 5. Subconsultas | 5.1 – 5.6 | `IN`, `NOT EXISTS` (regla anti-sobreventa), escalar, contra el promedio, en el `FROM`, correlacionada |
| 6. Funciones numéricas | 6.1 – 6.6 | `ROUND`, `TRUNC`, `CEIL`, `FLOOR`, `ABS`, `MOD`, `POWER`, `SQRT`, `GREATEST`; IVA y anticipos |
| 7. Manipulación de caracteres | 7.1 – 7.6 | `CONCAT`, `UPPER`, `INITCAP`, `SUBSTRING`, `SPLIT_PART`, `REPLACE`, `TRANSLATE`, `STRING_AGG`… (y `04_funciones_cadena.sql`) |
| 8. Reglas de precedencia | 8.1 – 8.6 | `*` antes que `+`, división entera, **`AND` antes que `OR` con resultados distintos**, `NOT`, el `CHECK` de RN-12 |

```bash
psql -h localhost -U pms_admin -d hotel_pms -f database/10_datos_demo.sql          # datos de demostración (una vez)
psql -h localhost -U pms_admin -d hotel_pms -f database/11_consultas_evaluacion.sql
```

## 4. Automatización (Telegram)

1. El backend guarda cada evento importante en `eventos_dominio`: reservación confirmada o cancelada, pago, check-in, check-out, cuarto a mantenimiento.
2. **PostgreSQL** arma el texto y decide a quién va (`database/09_notificaciones.sql`, con `CONCAT`, `STRING_AGG`, `TO_CHAR`).
3. **n8n** revisa cada minuto y lo envía por Telegram. Si falla, lo reintenta hasta 5 veces, sin duplicar mensajes.
4. **Node-RED** es el bot que conversa: el huésped manda su código de reservación y queda vinculado. A las 8:00 envía el resumen del día al grupo de recepción.
5. **Asistente del personal (n8n + IA Gemini):** otro bot, solo para recepción, gerencia y administración. Se le pregunta en lenguaje natural (*"¿qué tengo libre del 20 al 23 para 2?"*, *"¿cuánto cobramos esta semana?"*) y contesta usando funciones seguras de la BD (`database/12_asistente.sql`): la IA no escribe SQL, solo consulta y respeta el rol y el hotel de quien pregunta (RN-86 a RN-88).

La configuración paso a paso está en **[automation/README.md](automation/README.md)**.

## 5. Ejecución local y demostración

El sistema se entrega para correr en una computadora con Ubuntu (o Windows con WSL). Se abren **dos terminales**:

```bash
# Terminal 1 — base de datos y backend (API en http://localhost:3000)
sudo service postgresql start
cd ~/proyectoI/hotel-pms/backend && npm run dev

# Terminal 2 — frontend (abre http://localhost:5173)
cd ~/proyectoI/hotel-pms/frontend && npm run dev
```

### Mostrarlo desde otro dispositivo (opcional)

Con **Cloudflare Tunnel** se obtiene un enlace público temporal sin pagar ni configurar un servidor. Sirve para abrir el sistema desde un celular durante la presentación y para que Telegram pueda comunicarse con el sistema local.

```bash
# Terminal 3 (con los otros dos corriendo)
cloudflared tunnel --url http://localhost:5173
# → muestra un enlace como https://palabras-al-azar.trycloudflare.com
```

El enlace cambia cada vez que se ejecuta el comando y deja de funcionar al cerrarlo.
