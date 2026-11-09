# 📋 Reglas de negocio — PMS Hoteles Boutique y Posadas

Este documento lista **las reglas que el sistema debe cumplir**, dónde se aplican en el código y cómo comprobar que funcionan. Sirve para validar el proyecto con el profesor y con los hoteles, y para que todo el equipo trabaje con las mismas reglas.

> **Cómo usar este archivo:** cada vez que agreguemos o cambiemos una regla, se actualiza aquí primero. Una regla se marca como ✅ solo cuando ya está programada **y** se puede probar.

### Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Implementada y probada |
| 🟡 | Parcial: existe en una capa pero falta en otra |
| ⬜ | Pendiente de programar |
| ❓ | Falta que el hotel nos confirme el criterio |

**¿Dónde se aplica cada regla?** Las reglas se defienden en una o varias capas de la arquitectura hexagonal:

- **BD:** PostgreSQL la impide con restricciones o triggers (`database/01_schema.sql`). Es la protección final, ni un error de código la puede saltar.
- **Dominio:** la valida una entidad u objeto de valor en `backend/src/modules/*/domain/`.
- **Caso de uso:** la valida la aplicación en `backend/src/modules/*/application/use-cases/`.
- **Automatización:** la ejecuta n8n o Node-RED.

---

## Resumen

| Módulo | ✅ | 🟡 | ⬜ | ❓ |
|---|---|---|---|---|
| Reservaciones | 14 | 0 | 0 | 1 |
| Habitaciones | 6 | 0 | 0 | 0 |
| Huéspedes | 5 | 0 | 0 | 0 |
| Estancias (check-in / check-out) | 7 | 0 | 0 | 0 |
| Pagos | 6 | 0 | 0 | 1 |
| Tarifas | 4 | 0 | 0 | 0 |
| Usuarios, seguridad y administración | 10 | 0 | 0 | 0 |
| Automatización, notificaciones y asistente | 8 | 0 | 0 | 1 |
| **Total** | **60** | **0** | **0** | **3** |

---

## 1. Reservaciones

### RN-01 · Una habitación no se puede vender dos veces en las mismas fechas ✅
**Es la regla principal del proyecto: resuelve el problema de las sobreventas.**

- **Regla:** una habitación no puede tener dos reservaciones activas cuyas fechas se encimen.
- **Dónde se aplica:**
  - **Caso de uso** `CrearReservacion.js`: revisa disponibilidad antes de guardar y responde con un mensaje claro (HTTP 409).
  - **BD:** la restricción `no_sobreventa` (`EXCLUDE USING gist`) lo impide aunque dos recepcionistas guarden al mismo tiempo. El adaptador traduce el error `23P01` a HTTP 409.
- **Cómo validarlo:** crear una reservación para la habitación 201 que se encime con la existente. Debe fallar con `violates exclusion constraint "no_sobreventa"`.

### RN-02 · Se puede entrar el mismo día que otro huésped sale ✅
- **Regla:** las fechas se manejan como rango `[entrada, salida)`. El día de salida queda libre para un nuevo huésped.
- **Ejemplo:** si Ana sale el día 10, Lucas puede entrar el día 10.
- **Dónde se aplica:** BD (`daterange(..., '[)')`) y dominio (`RangoFechas.seEnciman`).
- **Cómo validarlo:** crear una reservación cuya `fecha_entrada` sea igual a la `fecha_salida` de otra en la misma habitación. Debe guardarse sin error.

### RN-03 · Solo las reservaciones activas ocupan la habitación ✅
- **Regla:** bloquean la habitación las reservaciones en estado `pendiente`, `confirmada` o `check_in`. Las que están en `cancelada`, `no_show` o `check_out` liberan las fechas.
- **Dónde se aplica:** BD (la cláusula `WHERE` de `no_sobreventa`) y el repositorio (`habitacionDisponible`).
- **Cómo validarlo:** cancelar una reservación y crear otra en las mismas fechas. Debe permitirse.

### RN-04 · La salida debe ser posterior a la entrada ✅
- **Regla:** mínimo 1 noche. No se aceptan fechas iguales ni invertidas.
- **Dónde se aplica:** dominio (`RangoFechas`) y BD (`CHECK (fecha_salida > fecha_entrada)`).
- **Cómo validarlo:** prueba unitaria `rechaza salida antes de entrada` (`npm test`).

### RN-05 · Debe haber al menos un adulto ✅
- **Regla:** `num_adultos ≥ 1` y `num_ninos ≥ 0`.
- **Dónde se aplica:** BD (`CHECK`).

### RN-06 · El número de noches y el total se calculan solos ✅
- **Regla:** `noches = fecha_salida − fecha_entrada` y `total = suma del precio de cada noche`. Nadie los captura a mano.
- Como cada noche puede tener distinto precio (ver RN-61), `precio_noche` guarda el **promedio** y `total` la suma exacta.
- **Dónde se aplica:** BD (`noches` es una columna generada) y dominio (servicio `Tarifador`).
- **Cómo validarlo:** pruebas `Tarifador.test.js` y `calcula noches y total`.

### RN-07 · Cada reservación tiene un código único ✅
- **Regla:** se genera automáticamente un código de 8 caracteres (ej. `3C8007D9`) para que el huésped lo dé al llegar o por Telegram.
- **Dónde se aplica:** BD (`DEFAULT` + `UNIQUE`).

### RN-08 · La habitación debe pertenecer al hotel de la reservación ✅
- **Regla:** no se puede reservar el cuarto de la posada A como si fuera del hotel B.
- **Dónde se aplica:** BD (trigger `trg_reservacion_hotel`).

### RN-09 · Solo se confirma una reservación pendiente ✅
- **Regla:** el único paso válido es `pendiente → confirmada`. Confirmar algo ya confirmado, cancelado o terminado se rechaza.
- **Dónde se aplica:** dominio (`Reservacion.confirmar()`) + caso de uso `ConfirmarReservacion` + ruta `PATCH /api/reservaciones/:id/confirmar`. Publica el evento `reservacion.confirmada`.
- **Cómo validarlo:** confirmar dos veces la misma reservación. La segunda vez responde HTTP 400 con `"regla": "RN-09"`.

### RN-10 · Solo se cancela una reservación que todavía no empieza ✅
- **Regla:** solo se pueden cancelar reservaciones `pendiente` o `confirmada`. Una en `check_in`, `check_out`, `no_show` o ya `cancelada` no se cancela.
- **Dónde se aplica:** dominio (`Reservacion.cancelar()`) + caso de uso `CancelarReservacion` + ruta `PATCH /api/reservaciones/:id/cancelar`. Publica el evento `reservacion.cancelada`, y al cancelar se liberan las fechas (RN-03).
- **Cómo validarlo:** cancelar dos veces la misma reservación. La segunda vez responde HTTP 400 con `"regla": "RN-10"`.

### RN-11 · No se reserva más gente de la que cabe en la habitación ✅
- **Regla:** `num_adultos ≤ capacidad_adultos` y `num_ninos ≤ capacidad_ninos` del tipo de habitación.
- **Dónde se aplica:**
  - **Dominio:** `Reservacion.validarHabitacion()`, llamada desde `CrearReservacion`. Responde HTTP 400 con un mensaje como *"La habitación 202 admite máximo 2 adulto(s) y 1 niño(s)"*.
  - **BD:** trigger `trg_reglas_reservacion` (`database/05_reglas_reservacion.sql`). También impide **editar** una reservación existente para meter más gente.
- **Cómo validarlo:** reservar 3 adultos en una habitación doble. Debe fallar.

### RN-12 · Toda cancelación debe tener motivo ✅
- **Regla:** al cancelar es obligatorio dar un motivo de al menos 5 caracteres. Se guarda en `motivo_cancelacion`, para que el hotel pueda analizar por qué pierde clientes. Los espacios de más se limpian.
- **Dónde se aplica:**
  - **Dominio:** `Reservacion.cancelar(motivo)`. Responde HTTP 400.
  - **BD:** restricción `rn12_cancelacion_con_motivo` (`05_reglas_reservacion.sql`).
- **Lección aprendida:** la primera versión del `CHECK` dejaba pasar un motivo vacío, porque en SQL `length(trim(NULL))` da `NULL` y un `CHECK` que da `NULL` **se considera aprobado**. La prueba automática lo detectó y se corrigió con `COALESCE`.
- **Cómo validarlo:** `PATCH /api/reservaciones/:id/cancelar` con cuerpo `{}`. Debe responder HTTP 400 con `"regla": "RN-12"`.

### RN-13 · No se reservan habitaciones en mantenimiento o fuera de servicio ✅
- **Regla:** no se puede reservar una habitación en `mantenimiento`, en `fuera_servicio` o dada de baja (`activo = false`). Una habitación en `limpieza` **sí** se puede reservar, porque es temporal.
- **Detalle importante:** si un cuarto entra a mantenimiento, sus reservaciones que ya existían se pueden seguir editando, para poder cancelarlas o cambiarlas de cuarto.
- **Dónde se aplica:**
  - **Dominio:** `Reservacion.validarHabitacion()`. Responde HTTP 409.
  - **BD:** trigger `trg_reglas_reservacion` (solo al crear la reservación o al cambiarla de habitación).
- **Cómo validarlo:** poner una habitación en mantenimiento e intentar reservarla. Debe fallar.

### RN-14 · No se crean reservaciones con fecha de entrada en el pasado ✅
- **Regla:** `fecha_entrada ≥ hoy`, en la zona horaria de Chiapas (America/Mexico_City). Reservar para el mismo día sí se permite.
- **Dónde se aplica:** **solo en el dominio** (`Reservacion.validarFechaNoPasada()`). La fecha de hoy la da el puerto `Reloj`, implementado por `RelojSistema`.
- **¿Por qué no en la BD?** Porque impediría cargar las reservaciones históricas cuando un hotel pase sus agendas de papel al sistema.
- **¿Por qué la zona horaria?** Los servidores en la nube suelen correr en hora UTC: a las 8 p.m. en Chiapas allá ya es el día siguiente, y sin este ajuste se rechazarían reservaciones válidas para hoy. Así el sistema funciona igual en la compu del hotel o en un servidor.
- **Cómo validarlo:** prueba unitaria `RN-14 rechaza fecha de entrada en el pasado`.

### RN-15 · ¿Cuánto tiempo puede estar una reservación "pendiente"? ❓
- **Pregunta para el hotel:** si una reservación pendiente no se confirma o no paga el anticipo en X horas, ¿se cancela sola? ¿Cuántas horas?

---

## 2. Habitaciones

### RN-20 · El número de habitación no se repite dentro del mismo hotel ✅
- **Dónde se aplica:** BD (`UNIQUE (hotel_id, numero)`). Dos hoteles distintos sí pueden tener cada uno una habitación "101".

### RN-21 · El nombre del tipo de habitación no se repite dentro del mismo hotel ✅
- **Dónde se aplica:** BD (`UNIQUE (hotel_id, nombre)`).

### RN-22 · Todo cambio de estado de una habitación queda registrado ✅
- **Regla:** cada vez que una habitación pasa, por ejemplo, de `ocupada` a `limpieza`, se guarda en `historial_habitacion` con el estado anterior, el nuevo y la fecha.
- **Dónde se aplica:** BD (trigger `trg_habitacion_historial`).

### RN-23 · No se borran habitaciones, huéspedes ni hoteles con reservaciones ✅
- **Regla:** se protege el historial. En lugar de borrar, se marca `activo = false`.
- **Dónde se aplica:** BD (`ON DELETE RESTRICT`).

### RN-24 · Los cambios de estado de una habitación siguen un orden ✅ *(nueva)*
- **Regla:** cambios que se pueden hacer a mano:

  | De ↓ / A → | disponible | limpieza | mantenimiento | fuera_servicio |
  |---|---|---|---|---|
  | **disponible** | — | ✔ | ✔ | ✔ |
  | **limpieza** | ✔ | — | ✔ | ✘ |
  | **mantenimiento** | ✔ | ✔ | — | ✔ |
  | **fuera_servicio** | ✔ | ✘ | ✔ | — |

  El estado `ocupada` **nunca** se pone ni se quita a mano: solo con check-in y check-out. Así el tablero siempre coincide con los huéspedes reales.
- **Dónde se aplica:** dominio (`Habitacion.cambiarEstado()`) + adaptador (`UPDATE ... WHERE estado = <anterior>`, que evita pisar el cambio de otra persona).
- **Ruta:** `PATCH /api/habitaciones/:id/estado` con `{ "estado": "disponible", "comentario": "..." }`. Así limpieza marca un cuarto como listo después del check-out.

### RN-25 · Sacar una habitación de servicio requiere explicar por qué ✅ *(nueva)*
- **Regla:** para pasar a `mantenimiento` o `fuera_servicio` el comentario es obligatorio, y queda en `historial_habitacion`. La respuesta incluye las **reservaciones próximas que hay que reubicar**.
- **Dónde se aplica:** caso de uso `CambiarEstadoHabitacion`.

---

## 3. Huéspedes

### RN-30 · Un documento de identidad pertenece a un solo huésped ✅
- **Regla:** no se repite la combinación tipo de documento + número (INE o pasaporte), para evitar huéspedes duplicados.
- **Dónde se aplica:** BD (`UNIQUE (tipo_documento, num_documento)`). El adaptador lo traduce a HTTP 409 *"Ya existe un huésped con ese documento"*.

### RN-31 · Nombre y apellidos son obligatorios y se guardan bien escritos ✅ *(nueva)*
- **Regla:** `"  maRÍA   josé "` se guarda como `"María José"`.
- **Dónde se aplica:** dominio (`Huesped`) + BD (trigger `trg_normalizar_huesped` de `04_funciones_cadena.sql`).

### RN-32 · Todo huésped tiene al menos un medio de contacto válido ✅ *(nueva)*
- **Regla:** correo o teléfono (o los dos), porque sin contacto no se puede confirmar la reservación. El correo debe tener formato válido y el teléfono entre 10 y 15 dígitos (se aceptan internacionales con `+`).
- **Dónde se aplica:** dominio (`Huesped`) + BD (restricción `rn32_contacto` en `07_reglas_huespedes.sql`).

### RN-33 · El documento se registra completo o no se registra ✅ *(nueva)*
- **Regla:** tipo y número van juntos. Tipos válidos: `INE`, `pasaporte`, `licencia`, `otro`. El número se guarda en mayúsculas y sin espacios ni guiones.
- **Dónde se aplica:** dominio + BD (restricción `rn33_documento_completo`).

### RN-34 · El documento completo nunca se envía al navegador ✅ *(nueva)*
- **Regla:** la API responde `"******0101"`. El número completo solo vive en la base de datos (protección de datos personales).
- **Dónde se aplica:** adaptador HTTP (`huesped.routes.js`).

### Búsqueda de huéspedes
`GET /api/huespedes?q=pérez` busca por nombre completo, correo, documento o teléfono, usando funciones de cadena (`CONCAT`, `ILIKE`). Los valores van como parámetros `$1`, nunca pegados al SQL, para evitar inyección SQL.

---

## 4. Estancias (check-in / check-out)

### RN-40 · Una reservación tiene como máximo una estancia ✅
- **Dónde se aplica:** BD (`reservacion_id UNIQUE` en `estancias`).

### RN-41 · El check-out es posterior al check-in ✅
- **Dónde se aplica:** BD (`CHECK`).

### RN-42 · Solo se hace check-in de una reservación confirmada ✅
- **Regla:** el paso válido es `confirmada → check_in`. Una reservación pendiente (sin confirmar), cancelada o ya hospedada no hace check-in.
- **Dónde se aplica:** dominio (`Reservacion.registrarCheckIn()`) + BD (trigger `trg_reglas_estancia` en `06_reglas_estancias_pagos.sql`).
- **Efecto:** en **una sola transacción** la reservación pasa a `check_in`, la habitación a `ocupada` y se crea la estancia con la hora real de llegada. Si algo falla, no se guarda nada. Publica `estancia.check_in`.
- **Ruta:** `POST /api/reservaciones/:id/check-in` (cuerpo opcional: `{ "placas": "...", "observaciones": "..." }`).

### RN-43 · Al hacer check-out la habitación pasa a limpieza ✅
- **Regla:** solo se hace check-out de una estancia en curso (`check_in → check_out`). En una sola transacción, la habitación pasa a `limpieza` y se guarda la hora real de salida.
- **Dónde se aplica:** dominio (`Reservacion.registrarCheckOut()`) + BD (trigger `trg_reglas_estancia`).
- **Aviso a limpieza:** publica el evento `estancia.check_out` con el número de habitación. Falta el flujo de n8n que manda el Telegram (RN-81).
- **Ruta:** `POST /api/reservaciones/:id/check-out`. Requiere RN-52.

### RN-44 · El check-in solo se hace durante las fechas reservadas ✅ *(nueva)*
- **Regla:** desde el día de entrada y antes del día de salida. Se puede llegar tarde (el segundo día), pero no antes del día de entrada, porque el cuarto puede estar ocupado por otro huésped.
- **Dónde se aplica:** dominio, con la fecha de hoy del puerto `Reloj` (hora de Chiapas).

### RN-45 · Solo se entrega una habitación lista ✅ *(nueva)*
- **Regla:** para hacer check-in, la habitación debe estar `disponible`. Si está en `limpieza`, `ocupada` (el huésped anterior no ha hecho check-out) o en `mantenimiento`, se rechaza con un mensaje que dice por qué.
- **Dónde se aplica:** dominio (`reglasHabitacion.js`) + adaptador (el `UPDATE ... WHERE estado = 'disponible'` evita que dos recepcionistas entreguen el mismo cuarto a la vez).
- **Diferencia con RN-13:** un cuarto en limpieza **sí se puede reservar** para otra fecha, pero **no se puede entregar** hasta que esté limpio.

### RN-46 · Las placas del vehículo se guardan normalizadas ✅ *(nueva)*
- **Regla:** se quitan espacios y guiones y se pasan a mayúsculas (`"dbc-12 34"` → `"DBC1234"`). Deben quedar entre 5 y 10 letras o números. Son opcionales.
- **Dónde se aplica:** dominio (`Estancia.normalizarPlacas()`).

---

## 5. Pagos

### RN-50 · Todo pago tiene un monto mayor a cero y un método válido ✅
- **Regla:** monto > 0, con máximo 2 decimales. Método: `efectivo`, `tarjeta`, `transferencia` o `deposito`.
- **Dónde se aplica:** dominio (`Pago`, `Dinero`) + BD (`CHECK (monto > 0)`).
- **Detalle técnico:** el dinero se maneja en **centavos enteros** (objeto de valor `Dinero`), porque en JavaScript `0.1 + 0.2 = 0.30000000000000004`.

### RN-51 · El saldo pendiente se calcula solo ✅
- **Regla:** `saldo = total − suma de pagos`.
- **Dónde se aplica:** dominio (`CuentaReservacion.saldo`) + BD (vista `v_saldo_reservaciones`).
- **Ruta:** `GET /api/reservaciones/:id/pagos` devuelve total, pagado, saldo y la lista de pagos.

### RN-52 · No se hace check-out con saldo pendiente ✅
- **Regla:** el saldo debe ser $0 para cerrar la estancia. El mensaje dice cuánto falta.
- **Dónde se aplica:** caso de uso `RegistrarCheckOut` + BD (trigger `trg_reglas_estancia`).

### RN-54 · No se cobra más que el saldo pendiente ✅ *(nueva)*
- **Regla:** la suma de pagos nunca puede pasar del total de la reservación.
- **Dónde se aplica:** dominio (`CuentaReservacion.validarPago()`) + BD (trigger `trg_reglas_pago`).
- **Cobros simultáneos:** el trigger usa `SELECT ... FOR UPDATE`, que bloquea la reservación mientras se revisa el saldo. Se probó con 10 cobros de $1,500 al mismo tiempo sobre una cuenta de $2,000: pasó 1 y la BD rechazó 9. Sin el bloqueo, dos cobros podrían pasar a la vez.

### RN-55 · Solo se cobra a reservaciones activas ✅ *(nueva)*
- **Regla:** se aceptan pagos en `pendiente`, `confirmada` y `check_in`. No en `cancelada`, `no_show` ni `check_out`.
- **Dónde se aplica:** dominio + BD (trigger `trg_reglas_pago`).

### RN-56 · Transferencias y depósitos llevan número de referencia ✅ *(nueva)*
- **Regla:** sin referencia no se puede rastrear el dinero en el banco. Se guarda limpia y en mayúsculas.
- **Dónde se aplica:** dominio (`Pago`).
- **Ruta:** `POST /api/reservaciones/:id/pagos` con `{ "monto": 1500, "metodo": "transferencia", "referencia": "SPEI123", "esAnticipo": true }`.

### RN-53 · ¿Cuánto anticipo se pide para confirmar? ❓
- **Pregunta para el hotel:** ¿qué porcentaje de anticipo se pide para confirmar (ej. 30 % o 50 %)? ¿Hay reembolso si se cancela?

---

## 6. Tarifas

### RN-60 · Las temporadas de un mismo tipo de habitación no se enciman ✅
- **Regla:** no puede haber dos tarifas de temporada para el mismo tipo de habitación con fechas que se traslapen.
- **Dónde se aplica:** BD (`EXCLUDE USING gist` en `tarifas_temporada`).

### RN-61 · El precio lo calcula el sistema, noche por noche ✅
- **Regla:** cada noche cobra la tarifa de temporada que la cubre; si no hay, el `precio_base` del tipo de habitación. **Cualquier precio que mande el cliente se ignora**: si no, alguien podría reservar a $1 la noche.
- **Ejemplo:** 18→22 dic en Doble chimenea, con Navidad desde el 20: 1100 + 1100 + 1500 + 1500 = **$5,200**.
- **Dónde se aplica:** servicio de dominio `Tarifador` (`reservaciones/domain/services`), usado por `CrearReservacion` y por la búsqueda de disponibilidad. Las temporadas llegan por el puerto `TarifaReader`.
- **Rutas:** `GET /api/hoteles/:hotelId/disponibilidad?entrada=&salida=&adultos=&ninos=` devuelve los cuartos libres con su total y su desglose. `POST /api/reservaciones` también regresa el desglose.

### RN-62 · Los precios siempre son válidos, y cambiarlos no altera lo ya vendido ✅ *(nueva)*
- **Regla:**
  - Una temporada lleva nombre (3 a 60 letras), fecha final posterior a la inicial y precio por noche mayor a cero (máximo $100,000, con 2 decimales).
  - El precio base se puede cambiar, pero **solo aplica a reservaciones nuevas**: las existentes ya guardaron su total (RN-06).
- **Dónde se aplica:** entidad `Temporada` (`tarifas/domain`) + casos de uso `CrearTemporada` y `CambiarPrecioBase`.
- **Pantalla:** *Hotel y tarifas* (admin y gerente).

### RN-63 · Las temporadas pasadas se conservan como historial ✅ *(nueva)*
- **Regla:** no se crean temporadas que ya terminaron, y no se borra una temporada que **ya empezó** (HTTP 409). Solo se pueden eliminar las futuras.
- **Dónde se aplica:** casos de uso `CrearTemporada` y `EliminarTemporada`, con el puerto `Reloj` para saber qué día es hoy.
- **Rutas:** `GET /api/hoteles/:hotelId/tarifas`, `PATCH …/tarifas/tipos/:tipoId`, `POST …/tarifas/temporadas`, `DELETE …/tarifas/temporadas/:id`.

---

## 7. Usuarios, seguridad y administración

### RN-70 · El correo de un usuario es único ✅
- **Dónde se aplica:** BD (`UNIQUE`; además `CITEXT` ignora mayúsculas, así que `ADMIN@pms.local` choca con `admin@pms.local`).

### RN-71 · Solo entra quien inicia sesión, y las contraseñas nunca se guardan en texto ✅
- **Regla:**
  - Todas las rutas de la API piden sesión, salvo `POST /api/auth/login` y `/api/health`.
  - Las contraseñas se guardan como hash **bcrypt** (lento a propósito para frenar ataques de fuerza bruta).
  - Si el login falla, el mensaje siempre es *"Correo o contraseña incorrectos"*: nunca dice cuál de los dos, para no revelar qué correos existen. Aunque el correo no exista, se hace la comparación igual, para que la respuesta tarde lo mismo.
  - La sesión es un token **JWT** que dura **8 horas** (un turno). Solo lleva el id del usuario: el rol se lee de la BD en cada petición, así que **desactivar a un usuario le quita el acceso al instante**.
  - Los hashes de contraseña nunca salen del servidor, ni siquiera en el explorador de la BD.
- **Dónde se aplica:** casos de uso `IniciarSesion` y `ObtenerSesion` + adaptadores `BcryptPasswordHasher` y `JwtTokenService` + BD (restricción `rn71_password_es_hash` en `08_reglas_usuarios.sql`: si alguien intenta guardar `"Demo1234"` tal cual, la BD lo rechaza).

### RN-72 · Cada rol tiene permisos distintos ✅
| Acción | admin | gerente | recepción | limpieza |
|---|---|---|---|---|
| Reservaciones: crear, confirmar, cancelar, consultar | ✔ | ✔ | ✔ | ✘ |
| Buscar disponibilidad y precios | ✔ | ✔ | ✔ | ✘ |
| Check-in / check-out | ✔ | ✔ | ✔ | ✘ |
| Cobrar y ver estado de cuenta | ✔ | ✔ | ✔ | ✘ |
| Registrar y buscar huéspedes | ✔ | ✔ | ✔ | ✘ |
| Ver habitaciones | ✔ | ✔ | ✔ | ✔ |
| Marcar cuarto en limpieza / limpio | ✔ | ✔ | ✔ | ✔ |
| Mandar cuarto a mantenimiento o fuera de servicio (y regresarlo) | ✔ | ✔ | ✔ | ✘ |
| Cambiar precios y temporadas | ✔ | ✔ | ✘ | ✘ |
| Ver reportes de ocupación e ingresos | ✔ | ✔ | ✘ | ✘ |
| Configurar datos del hotel (contacto, horarios, Telegram) | ✔ | ✔ | ✘ | ✘ |
| Gestionar personal | ✔ todos | ✔ solo recepción y limpieza (RN-76) | ✘ | ✘ |
| Ver el explorador de la BD | ✔ | ✘ | ✘ | ✘ |

- **Dónde se aplica:** la tabla vive en **un solo lugar**, `usuarios/domain/permisos.js`. El backend la usa en el middleware `permitir()`, y el frontend la recibe en `usuario.permisos` al iniciar sesión, para mostrar u ocultar botones. El cambio de estado de habitación se revisa en el caso de uso, porque depende del estado actual.
- **Respuesta:** HTTP 403 con `"regla": "RN-72"`.

### RN-73 · Contraseñas seguras ✅ *(nueva)*
- **Regla:** de 8 a 72 caracteres, con letras y números. Al cambiarla hay que dar la actual, y la nueva debe ser distinta.
- **Dónde se aplica:** dominio (`Usuario.validarPassword()`). *El 72 es el límite real de bcrypt.*
- **Ruta:** `POST /api/auth/password` con `{ "actual": "...", "nueva": "..." }`.

### RN-74 · Bloqueo tras 5 intentos fallidos ✅ *(nueva)*
- **Regla:** después de 5 contraseñas equivocadas para el mismo correo, se bloquea el login 15 minutos (HTTP 429), aunque luego se escriba la correcta.
- **Dónde se aplica:** caso de uso `IniciarSesion` + puerto `ContadorIntentos`.
- **Limitación conocida:** el adaptador actual (`MemoriaContadorIntentos`) guarda la cuenta en memoria: se reinicia si se reinicia el servidor. Si algún día corre en varios servidores, se cambiaría por un adaptador con Redis o con una tabla, **sin tocar el caso de uso** (esa es la ventaja de la arquitectura hexagonal).

### RN-75 · Cada usuario solo trabaja con su hotel ✅ *(nueva)*
- **Regla:** la recepcionista de Posada Los Arcos no puede ver ni tocar reservaciones, habitaciones ni cobros del Hotel Boutique Cañón. Solo el **admin general** (sin hotel asignado) ve todos los hoteles. Todo usuario que no es admin debe tener hotel.
- **Dónde se aplica:** middleware `soloSuHotel()` (busca a qué hotel pertenece la reservación o la habitación) + entidad `Usuario` + BD (restricción `rn75_usuario_con_hotel`).
- **Nota:** el registro de **huéspedes es compartido** entre los hoteles a propósito: un viajero que se hospeda en los dos no se captura dos veces.
- **Respuesta:** HTTP 403 con `"regla": "RN-75"`.

### RN-76 · El gerente administra solo a recepción y limpieza de su hotel ✅ *(nueva)*
- **Regla:** el gerente puede dar de alta, editar, desactivar y cambiar la contraseña de recepcionistas y personal de limpieza **de su hotel**. No puede crear ni modificar gerentes ni administradores. El administrador de un hotel maneja a todo su hotel; el admin general, a todos.
- **Dónde se aplica:** política de dominio `usuarios/domain/politicaPersonal.js`, que se revisa **antes y después** de cada cambio (así nadie convierte a una recepcionista en gerente). La API marca cada usuario con `editable` para que la pantalla solo muestre los botones permitidos.
- **Respuesta:** HTTP 403 con `"regla": "RN-76"`.

### RN-77 · Nadie se cambia a sí mismo el rol, el hotel o el acceso ✅ *(nueva)*
- **Regla:** un usuario no puede desactivarse, cambiarse de rol ni de hotel, ni restablecer su propia contraseña desde *Personal* (para eso está *Mi cuenta*). Evita que el sistema se quede sin administrador por error.
- **Dónde se aplica:** casos de uso `ActualizarUsuario` y `RestablecerPassword`.
- **Rutas:** `PATCH /api/usuarios/:id` (nombre, rol, hotel, activo, chat de Telegram) y `POST /api/usuarios/:id/password`.

### RN-78 · Reportes de ocupación e ingresos ✅ *(nueva)*
- **Regla:** administración y gerencia consultan, para un periodo de **máximo un año** (30 días si no se indica):
  - **Ocupación** = noches vendidas ÷ noches disponibles.
  - **ADR** (tarifa promedio) = ingreso de hospedaje ÷ noches vendidas.
  - **RevPAR** = ingreso de hospedaje ÷ noches disponibles.
  - Dinero cobrado por método de pago, reservaciones por canal y por estado, motivos de cancelación y saldo por cobrar.
  - Solo cuentan como vendidas las reservaciones confirmadas, hospedadas o que ya salieron.
- **Dónde se aplica:** servicio de dominio `Indicadores` (en centavos, sin errores de redondeo) + caso de uso `GenerarReporte` + adaptador `PostgresReporteRepository` (usa `generate_series` para tener una fila por día).
- **Ruta:** `GET /api/hoteles/:hotelId/reportes?desde=&hasta=`. **Pantalla:** *Reportes*.

### RN-79 · Los datos del hotel siempre son válidos ✅ *(nueva)*
- **Regla:** teléfono de 10 a 13 dígitos, correo válido, horas en formato HH:MM, y **la hora de salida debe ser anterior a la de entrada** (así queda tiempo para limpiar el cuarto el mismo día, RN-02). El chat de Telegram de recepción es un número.
- **Dónde se aplica:** objeto de valor `ConfiguracionHotel` + caso de uso `ConfigurarHotel`.
- **Ruta:** `PATCH /api/hoteles/:hotelId`. **Pantalla:** *Hotel y tarifas*.

---

## 8. Automatización y notificaciones

**Cómo funciona:** el backend guarda cada evento en `eventos_dominio` (patrón *outbox*). PostgreSQL arma los textos con funciones de cadena (`database/09_notificaciones.sql`). **n8n** los envía y **Node-RED** atiende la conversación con el bot. Así, si Telegram o n8n se caen, el sistema del hotel sigue funcionando y los avisos salen cuando regresan.

### RN-80 · Todo evento importante queda registrado para las automatizaciones ✅
- **Regla:** reservación creada, confirmada o cancelada, pago registrado, check-in, check-out y cambio de estado de habitación generan un evento en `eventos_dominio`, en la **misma petición** que hizo el cambio.
- **Dónde se aplica:** casos de uso + adaptador `PostgresOutboxPublisher`.

### RN-81 · El huésped recibe sus avisos por Telegram ✅
- **Regla:** cuando el huésped vincula su Telegram, recibe la confirmación de su reservación, los recibos de pago, la bienvenida al hacer check-in y, si se cancela, el aviso con el motivo.
- **Cómo se vincula:** recepción le manda el enlace `t.me/<bot>?start=<código>` (botón **Copiar** en el detalle de la reservación). Al abrirlo, el bot reconoce el código y guarda su chat. También puede escribir el código a mano. Solo se vinculan reservaciones activas.
- **Comandos del bot:** `/estado` (mis reservaciones) y `/miid` (número del chat, para configurar recepción).
- **Dónde se aplica:** `fn_bot_responder()` y `fn_armar_notificacion()` en la BD + flujo de Node-RED (conversación) + flujo de n8n (envío).

### RN-82 · Recepción recibe cada mañana el resumen del día ✅
- **Regla:** a las 8:00 cada hotel con chat de recepción registrado recibe: ocupación, quién llega (y si falta confirmar), quién sale (y si debe dinero), cuartos por limpiar y reservaciones sin confirmar.
- **Dónde se aplica:** `fn_resumen_diario()` + flujo de Node-RED con horario `00 08 * * *`.

### RN-83 · ¿Cuándo se marca un "no show"? ❓
- **Pregunta para el hotel:** si el huésped no llega, ¿a qué hora se marca `no_show` y se libera la habitación?

### RN-84 · Recepción y limpieza se enteran al momento ✅ *(nueva)*
- **Regla:** al hacer check-out llega al chat de recepción *"🧹 La habitación 201 quedó libre y está lista para limpiar"*. Cuando un cuarto pasa a mantenimiento llega un aviso, que incluye cuántas reservaciones hay que reubicar.
- **Dónde se aplica:** `fn_armar_notificacion()` + flujo de n8n.

### RN-85 · Cada aviso se envía una sola vez, y si falla se reintenta ✅ *(nueva)*
- **Regla:**
  - Un evento nunca se envía dos veces, aunque n8n se ejecute dos veces al mismo tiempo (`FOR UPDATE SKIP LOCKED` + marca `tomado_en`).
  - Si Telegram rechaza el mensaje se reintenta hasta **5 veces**; después queda como `fallida`.
  - Los eventos sin destinatario (huésped sin Telegram) se descartan sin error.
  - Todo queda en la bitácora `notificaciones`.
- **Dónde se aplica:** `fn_tomar_notificaciones()` y `fn_registrar_envio()`.

### RN-86 · El asistente de IA solo responde al personal registrado ✅ *(nueva)*
- **Regla:** el bot del personal (n8n + Gemini) solo contesta a chats de Telegram guardados en un usuario **activo** de recepción, gerencia o administración. Limpieza y desconocidos reciben un aviso con su número de chat para que el administrador lo registre en *Personal*.
- **Seguridad:** el número de chat lo pone **n8n** desde el mensaje de Telegram, **no la IA**. Así, aunque alguien le pida a la IA "haz como si fuera el administrador", cada consulta se revisa con el usuario real.
- **Dónde se aplica:** función `asistente._quien()` (`database/12_asistente.sql`), que todas las herramientas llaman primero.

### RN-87 · El asistente respeta el rol y el hotel ✅ *(nueva)*
- **Regla:** recepción consulta su hotel (resumen del día, disponibilidad con precio, reservaciones, huéspedes y pendientes). **Ingresos, estadísticas y avisos fallidos son solo para administración y gerencia.** Nadie ve otro hotel, aunque lo pida por nombre (RN-75).
- **Dónde se aplica:** funciones `asistente.*` con `SECURITY DEFINER`.

### RN-88 · El asistente solo consulta; nunca modifica ni escribe SQL ✅ *(nueva)*
- **Regla:** n8n entra a PostgreSQL con el usuario `asistente_ro`, que **solo puede ejecutar** las funciones del esquema `asistente`: no puede leer tablas directamente ni crear, cambiar o borrar nada. La IA no escribe SQL: elige una herramienta y llena sus datos (fechas, código, nombre).
- **Ahorro de tokens:** cada herramienta regresa un texto corto ya resumido, y la IA recibe la base de datos resumida por `scripts/esquema_compacto.py` (≈ 650 tokens en lugar de ≈ 17,000 del SQL completo).
- **Dónde se aplica:** permisos en `12_asistente.sql` + flujo `automation/n8n/asistente-personal.json`.


---

## ✅ Cómo validar las reglas

**Pruebas del dominio** (no necesitan base de datos):
```bash
cd backend && npm test
```
Son 211 pruebas. Cubren las reglas de reservaciones, precios, temporadas, reportes, huéspedes, habitaciones, pagos, estancias, seguridad (permisos por rol, sesiones, bloqueo de intentos) y administración del personal usando adaptadores falsos (arquitectura hexagonal), y también revisan que el adaptador de PostgreSQL mande bien las fechas.

**Pruebas de las reglas en la base de datos.** Prueba RN-01 a RN-08, RN-11, RN-12, RN-13, RN-20, RN-22, RN-23, RN-30, RN-32, RN-33, RN-41 a RN-43, RN-50, RN-52, RN-54, RN-55, RN-60, RN-70, RN-71, RN-75, RN-81, RN-85 y el asistente RN-86 a RN-88 (65 pruebas). No deja cambios porque todo se deshace al final. Requiere haber cargado los datos de prueba (`02_seed.sql`) y los archivos `05` a `09` y `12`:
```bash
psql -h localhost -U pms_admin -d hotel_pms < database/03_validar_reglas.sql 2>&1 | sed 's/NOTICE:  //'
```
Cada regla debe imprimir `✅ PASA`. Si alguna dice `❌ FALLA`, algo se rompió.

---

## Preguntas pendientes para el hotel

1. **RN-15:** ¿cuántas horas puede estar una reservación sin confirmar antes de cancelarse sola?
2. **RN-53:** ¿qué porcentaje de anticipo se pide y cuál es la política de reembolso?
3. **RN-83:** ¿a qué hora se marca a un huésped como "no se presentó"?

## Historial de cambios

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-07 | Primera versión: 37 reglas documentadas | Equipo |
| 2026-10-26 | RN-11, RN-13 y RN-14 implementadas en el dominio (+ RN-11 y RN-13 en la BD) | Edwin |
| 2026-10-26 | RN-09, RN-10 y RN-12: confirmar y cancelar con motivo (+ RN-12 en la BD). Corregido error que guardaba las fechas un día antes | Edwin |
| 2026-10-26 | Módulos de pagos y estancias: check-in, check-out, pagos y saldo (RN-42, 43, 52 + nuevas RN-44, 45, 46, 54, 55, 56). Total: 43 reglas | Edwin |
| 2026-10-26 | Huéspedes, habitaciones, hoteles y precio automático (RN-61 + nuevas RN-24, 25, 31, 32, 33, 34). Total: 49 reglas | Edwin |
| 2026-10-26 | Login y roles: RN-71, RN-72 + nuevas RN-73, 74, 75. Corregido: el explorador enviaba los hashes de contraseña al navegador. Total: 52 reglas | Edwin |
| 2026-11-04 | Notificaciones por Telegram con n8n y Node-RED: RN-81, RN-82 + nuevas RN-84, RN-85. Total: 54 reglas, **51 implementadas** y 3 preguntas para el hotel | Edwin |
| 2026-11-09 | Funciones de administración y gerencia: tarifas (nuevas RN-62, 63), personal (nuevas RN-76, 77), reportes (RN-78), datos del hotel (RN-79) y asistente de IA para el personal (RN-86, 87, 88). Total: 63 reglas, **60 implementadas** y 3 preguntas para el hotel | Edwin |
