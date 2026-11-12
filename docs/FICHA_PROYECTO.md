# Proyecto 9. Sistema de gestión para hoteles boutique y posadas

**Área de aplicación:** Turismo

> Texto listo para copiar en la tabla de la ficha. Los campos 1 a 3 son los originales (el 3 con el detalle de lo que se usó); los campos 4 a 7 son nuevos.

---

### 1. La idea
Sistema de administración hotelera (PMS) para reservaciones, registro de huéspedes, asignación de cuartos y control de ocupación.

### 2. Contexto
Los hoteles boutique y posadas familiares en Tuxtla y San Cristóbal operan con agendas manuales, causando sobreventas de habitaciones.

### 3. Tecnología de implementación
Frontend en **React (Vite)** con arquitectura basada en componentes; backend en **Node.js (Express)** con arquitectura hexagonal; base de datos **PostgreSQL**; automatización con **n8n**, **Node-RED** y **Telegram Bot**. Despliegue en **AWS (EC2 con nginx y RDS PostgreSQL)**; desarrollo en **Ubuntu (WSL)**.

### 4. Problema específico
En los hoteles boutique y posadas familiares de Tuxtla Gutiérrez y San Cristóbal de las Casas, las reservaciones se anotan en agendas de papel o en mensajes de WhatsApp, sin una fuente única que muestre qué habitaciones están ocupadas en cada fecha. Cuando dos personas del personal reciben solicitudes al mismo tiempo, o un huésped cambia sus fechas, la misma habitación se vende dos veces (**sobreventa**). Esto obliga a reubicar o rechazar huéspedes a su llegada y daña la reputación del establecimiento. El registro manual también provoca otros problemas: no se sabe con certeza cuánto debe cada huésped, se pierde el historial de anticipos, el personal de limpieza no se entera a tiempo de qué cuartos se liberaron y los precios de temporada alta se calculan a mano, con errores.

### 5. Metodología de desarrollo
Desarrollo **iterativo e incremental**, como adaptación de Scrum para un solo desarrollador. Primero se documentaron las **reglas de negocio** (63 reglas numeradas, `docs/REGLAS_DE_NEGOCIO.md`) y cada iteración entregó un módulo funcional y probado:

1. Modelo de datos y regla anti-sobreventa.
2. Ciclo de vida de la reservación: crear, confirmar y cancelar.
3. Pagos, check-in y check-out.
4. Huéspedes, habitaciones y precio por temporada.
5. Usuarios, roles y seguridad.
6. Interfaz web.
7. Automatizaciones.
8. Administración y gerencia: tarifas, personal, reportes y asistente con IA.

Cada regla se valida con **pruebas automáticas**: 211 pruebas del backend y 65 pruebas de la base de datos. El código se versiona en **GitHub** con un commit por iteración.

### 6. Solución técnica
Aplicación web de tres capas, ejecutada en local:

- **Frontend React** basado en componentes reutilizables, con pantallas para recepción, limpieza, gerencia y administración (reportes de ocupación e ingresos, tarifas por temporada y gestión del personal). Cada rol ve solo lo que le corresponde.
- **API en Node.js con arquitectura hexagonal:** las reglas de negocio viven en el dominio, aisladas de Express y de PostgreSQL mediante puertos y adaptadores.
- **PostgreSQL como segunda capa de protección:**
  - La restricción `EXCLUDE USING gist` sobre rangos de fechas impide físicamente la sobreventa, incluso con dos recepcionistas guardando al mismo tiempo.
  - Los triggers y las transacciones con bloqueo (`FOR UPDATE`) evitan cobros de más y check-outs con saldo pendiente.

Además:
- El precio se calcula noche por noche según la temporada.
- La seguridad usa contraseñas con **bcrypt**, sesiones **JWT**, permisos por rol y la regla de que cada usuario solo trabaja con su propio hotel.
- Cada acción importante guarda un evento que **n8n** y **Node-RED** leen para enviar avisos por **Telegram**: confirmación al huésped, aviso a limpieza y resumen diario.
- Un **asistente con IA** (n8n + Gemini) responde por Telegram las preguntas del personal usando solo funciones de consulta de la base de datos, con permisos según el rol.

### 7. Metodología de investigación
Investigación **aplicada**, de enfoque **mixto** y alcance **descriptivo**, con estos instrumentos:

1. **Entrevistas semiestructuradas** a encargados de hoteles boutique y posadas en Tuxtla y San Cristóbal (muestra por conveniencia de 3 a 5 establecimientos). Buscan conocer su proceso actual, la frecuencia de sobreventas y sus políticas de anticipo, cancelación y no-show.
2. **Observación** del proceso de registro en mostrador.
3. **Revisión documental** de sistemas PMS comerciales como referencia.

Los hallazgos se convierten en reglas de negocio. La solución se valida con:
- **Pruebas automáticas** de cada regla.
- **Pruebas de concurrencia:** 10 cobros simultáneos sobre una misma cuenta, de los que solo uno se acepta.
- Si es posible, una **prueba piloto** que compare indicadores antes y después: sobreventas, tiempo de check-in y errores de cobro.

---

## Notas para la entrega (no copiar en la ficha)

- **Campo 3:** el despliegue en AWS está en `deploy/aws/README.md` (AWS Academy Learner Lab).
- **Campo 7:** las entrevistas y la observación **hay que hacerlas** antes de presentar resultados. Preguntas clave pendientes (ver `REGLAS_DE_NEGOCIO.md`):
  1. ¿Cuántas horas puede estar una reservación sin confirmar antes de cancelarse sola? (RN-15)
  2. ¿Qué porcentaje de anticipo se pide y cuál es la política de reembolso? (RN-53)
  3. ¿A qué hora se marca a un huésped como "no se presentó"? (RN-83)
  4. ¿Cuántas veces al mes ocurre una sobreventa? ¿Qué hacen cuando pasa?
  5. ¿Cuánto tarda hoy un check-in? ¿Cómo saben cuánto debe un huésped?
- **Cifras:** no se incluyen porcentajes de sobreventa porque todavía no hay datos reales. Cuando hagas las entrevistas, se pueden agregar al campo 4 para fortalecerlo.
