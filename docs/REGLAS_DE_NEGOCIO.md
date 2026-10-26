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
| Habitaciones | 4 | 0 | 0 | 0 |
| Huéspedes | 1 | 0 | 0 | 0 |
| Estancias (check-in / check-out) | 2 | 0 | 2 | 0 |
| Pagos | 2 | 0 | 1 | 1 |
| Tarifas | 1 | 0 | 1 | 0 |
| Usuarios y seguridad | 1 | 0 | 2 | 0 |
| Automatización y notificaciones | 1 | 0 | 2 | 1 |
| **Total** | **26** | **0** | **8** | **3** |

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
- **Regla:** `noches = fecha_salida − fecha_entrada` y `total = noches × precio_noche`. Nadie los captura a mano.
- **Dónde se aplica:** BD (`noches` es una columna generada) y dominio (`Reservacion.total`).
- **Cómo validarlo:** prueba unitaria `calcula noches y total`.

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
- **¿Por qué la zona horaria?** En AWS el servidor corre en hora UTC: a las 8 p.m. en Chiapas allá ya es el día siguiente, y sin este ajuste se rechazarían reservaciones válidas para hoy.
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

---

## 3. Huéspedes

### RN-30 · Un documento de identidad pertenece a un solo huésped ✅
- **Regla:** no se repite la combinación tipo de documento + número (INE o pasaporte), para evitar huéspedes duplicados.
- **Dónde se aplica:** BD (`UNIQUE (tipo_documento, num_documento)`).

---

## 4. Estancias (check-in / check-out)

### RN-40 · Una reservación tiene como máximo una estancia ✅
- **Dónde se aplica:** BD (`reservacion_id UNIQUE` en `estancias`).

### RN-41 · El check-out es posterior al check-in ✅
- **Dónde se aplica:** BD (`CHECK`).

### RN-42 · Solo se hace check-in de una reservación confirmada ⬜
- **Regla:** al hacer check-in, la reservación pasa de `confirmada` a `check_in` y la habitación pasa a `ocupada`.

### RN-43 · Al hacer check-out la habitación pasa a limpieza ⬜
- **Regla:** la reservación pasa a `check_out`, la habitación a `limpieza`, y se avisa por Telegram al personal de limpieza. Ver también RN-52.

---

## 5. Pagos

### RN-50 · Todo pago tiene un monto mayor a cero ✅
- **Dónde se aplica:** BD (`CHECK (monto > 0)`).

### RN-51 · El saldo pendiente se calcula solo ✅
- **Regla:** `saldo = total − suma de pagos`.
- **Dónde se aplica:** BD (vista `v_saldo_reservaciones`).

### RN-52 · No se hace check-out con saldo pendiente ⬜
- **Regla:** el saldo debe ser 0 para cerrar la estancia.

### RN-53 · ¿Cuánto anticipo se pide para confirmar? ❓
- **Pregunta para el hotel:** ¿qué porcentaje de anticipo se pide para confirmar (ej. 30 % o 50 %)? ¿Hay reembolso si se cancela?

---

## 6. Tarifas

### RN-60 · Las temporadas de un mismo tipo de habitación no se enciman ✅
- **Regla:** no puede haber dos tarifas de temporada para el mismo tipo de habitación con fechas que se traslapen.
- **Dónde se aplica:** BD (`EXCLUDE USING gist` en `tarifas_temporada`).

### RN-61 · La tarifa de temporada reemplaza al precio base ⬜
- **Regla:** al crear la reservación, si la fecha cae en una temporada (ej. Semana Santa) se usa `precio_noche` de la temporada; si no, el `precio_base` del tipo.

---

## 7. Usuarios y seguridad

### RN-70 · El correo de un usuario es único ✅
- **Dónde se aplica:** BD (`UNIQUE`; además `CITEXT` ignora mayúsculas).

### RN-71 · Las contraseñas se guardan cifradas ⬜
- **Regla:** se guarda solo el hash bcrypt, nunca la contraseña en texto. Los datos de prueba ya cumplen, pero falta el módulo de registro e inicio de sesión.

### RN-72 · Cada rol tiene permisos distintos ⬜
| Acción | admin | gerente | recepción | limpieza |
|---|---|---|---|---|
| Crear / cancelar reservaciones | ✔ | ✔ | ✔ | ✘ |
| Check-in / check-out | ✔ | ✔ | ✔ | ✘ |
| Cambiar estado de limpieza | ✔ | ✔ | ✔ | ✔ |
| Registrar pagos | ✔ | ✔ | ✔ | ✘ |
| Cambiar tarifas y habitaciones | ✔ | ✔ | ✘ | ✘ |
| Gestionar usuarios | ✔ | ✘ | ✘ | ✘ |

---

## 8. Automatización y notificaciones

### RN-80 · Todo evento importante queda registrado para las automatizaciones ✅
- **Regla:** al crear una reservación se inserta el evento `reservacion.creada` en `eventos_dominio`. Desde ahí lo leen n8n y Node-RED.
- **Dónde se aplica:** caso de uso + adaptador `PostgresOutboxPublisher`.

### RN-81 · El huésped recibe su confirmación por Telegram ⬜
- **Regla:** n8n lee los eventos `reservacion.creada` sin procesar, envía el mensaje, lo registra en `notificaciones` y marca el evento como procesado.

### RN-82 · Recepción recibe cada mañana el resumen del día ⬜
- **Regla:** Node-RED envía a las 8:00 el porcentaje de ocupación (`v_ocupacion_hoy`) y las llegadas del día.

### RN-83 · ¿Cuándo se marca un "no show"? ❓
- **Pregunta para el hotel:** si el huésped no llega, ¿a qué hora se marca `no_show` y se libera la habitación?

---

## ✅ Cómo validar las reglas

**Pruebas del dominio** (no necesitan base de datos):
```bash
cd backend && npm test
```
Son 37 pruebas. Cubren RN-01, 04, 05, 06, 08, 09, 10, 11, 12, 13 y 14 usando adaptadores falsos (arquitectura hexagonal), y también revisan que el adaptador de PostgreSQL mande bien las fechas.

**Pruebas de las reglas en la base de datos.** Prueba RN-01 a RN-08, RN-11, RN-12, RN-13, RN-20, RN-22, RN-23, RN-30, RN-41, RN-50 y RN-60. No deja cambios porque todo se deshace al final. Requiere haber cargado los datos de prueba (`02_seed.sql`) y las reglas de `05_reglas_reservacion.sql`:
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
