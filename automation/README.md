# 🤖 Automatizaciones: Telegram con n8n y Node-RED

| Pieza | Archivo | Qué hace |
|---|---|---|
| **PostgreSQL** | `database/09_notificaciones.sql` | Arma los mensajes y decide a quién van (RN-81, 82, 84, 85) |
| **n8n** | `automation/n8n/notificaciones-telegram.json` | Cada minuto envía los avisos pendientes |
| **Node-RED** | `automation/node-red/flows.json` | El bot conversa con el huésped (ve precios, reserva, paga) y manda el resumen de las 8:00 a recepción |
| **PostgreSQL** | `database/14_bot_huespedes.sql` | La conversación del bot de huéspedes: menú, disponibilidad, reservación y pago simulado (RN-89 a RN-93) |

```
backend ──► eventos_dominio ──► n8n (cada minuto) ──► Telegram ──► huésped / recepción
huésped ──► Telegram ──► Node-RED ──► fn_bot_responder() ──► respuesta
Node-RED (8:00) ──► fn_resumen_diario() ──► Telegram ──► grupo de recepción
```

Necesitas: el **token** y el **usuario** de tu bot (los que te dio @BotFather; el usuario termina en `bot`).

> ⚠️ **Un bot solo puede recibir mensajes en un programa a la vez.** Node-RED es quien escucha. Si en n8n tienes otro flujo con un nodo **Telegram Trigger** usando este mismo bot, desactívalo; si no, el bot dejará de responder en Node-RED.

---

## Paso 1 · Funciones en la base de datos
```bash
cd ~/proyectoI/hotel-pms
PGPASSWORD=PI123 psql -h localhost -U pms_admin -d hotel_pms -f database/09_notificaciones.sql
PGPASSWORD=PI123 psql -h localhost -U pms_admin -d hotel_pms -f database/14_bot_huespedes.sql
```

**Qué puede hacer el huésped con el bot** (rol de cliente):

| Escribe | El bot |
|---|---|
| `hola` o `menu` | Muestra el menú de 4 opciones |
| `1` | Lista los tipos de habitación con capacidad y precio |
| `2` | Pregunta llegada, salida (o noches) y personas; muestra lo libre con el total; pide nombre y teléfono; reserva |
| `3` | Muestra sus reservaciones |
| `4` | Le deja elegir: **efectivo en el mostrador** o **pago simulado** (anticipo del 30 % o todo) |
| su código de 8 caracteres | Vincula el chat a esa reservación para recibir avisos |

El pago es una **simulación**: no se cobra dinero real. Queda registrado con referencia `SIMULADO-…` y, si cubre el anticipo, la reservación se confirma sola. Recepción recibe aviso de cada reservación y pago hechos por el bot.

## Paso 2 · Node-RED (el bot que conversa)
```bash
# Si no lo tienes instalado
sudo npm install -g --unsafe-perm node-red

# Los dos complementos que usa el flujo
mkdir -p ~/.node-red && cd ~/.node-red
npm install node-red-contrib-telegrambot node-red-contrib-postgresql

node-red        # déjalo corriendo; abre http://localhost:1880
```
1. En Node-RED: menú ☰ → **Import** → **select a file to import** → elige `automation/node-red/flows.json` → **Import**.
2. Doble clic en el nodo **Mensaje recibido** → lápiz ✏️ junto a *Bot*:
   - **Bot-Name:** el usuario de tu bot, sin `@`.
   - **Token:** el token de @BotFather.
   - **Update Mode:** `Polling` (ya viene así; no necesita internet público).
3. Doble clic en **fn_bot_responder** → lápiz ✏️ junto a *Server* → pestaña **Security**:
   - **User:** `pms_admin`
   - **Password:** `PI123`
4. Botón rojo **Deploy**.
5. **Prueba:** escríbele `hola` a tu bot en Telegram. Debe contestar con el menú: *"¡Hola…! 👋 Soy el asistente de Posada Los Arcos…"*. Luego escribe `2` y haz una reservación completa.

## Paso 3 · Chat de recepción (avisos de limpieza y resumen diario)
1. En Telegram crea un grupo, por ejemplo *"Recepción Posada Los Arcos"*, y agrega a tu bot.
2. En el grupo escribe `/miid`. El bot responde con un número que empieza con `-100…`.
3. Guárdalo en el hotel:
   ```bash
   psql -h localhost -U pms_admin -d hotel_pms -c "UPDATE hoteles SET telegram_chat_id = '-100XXXXXXXXXX' WHERE nombre = 'Posada Los Arcos';"
   ```
4. En Node-RED, clic en el cuadrito del nodo **Probar ahora**. Debe llegar el resumen del día al grupo.

## Paso 4 · n8n (envío de avisos)
1. Abre n8n (normalmente http://localhost:5678).
2. **Credenciales** (menú *Credentials* → *Add credential*):
   - **Postgres** → nómbrala `PMS PostgreSQL`
     Host `localhost` · Database `hotel_pms` · User `pms_admin` · Password `PI123` · Port `5432` · SSL `disable`.
     *Si n8n corre en Docker, el host es `host.docker.internal`.*
   - **Telegram API** → nómbrala `Bot del hotel` · Access Token: el token de @BotFather.
3. **Workflows** → **Import from File** → `automation/n8n/notificaciones-telegram.json`.
4. Abre cada nodo con ⚠️ (*Tomar notificaciones*, *Enviar por Telegram*, *Marcar enviada*, *Marcar fallida*) y elige la credencial correspondiente.
5. **Save** y activa el interruptor **Active** (arriba a la derecha).

## Paso 5 · Enlace en el frontend
```bash
cd ~/proyectoI/hotel-pms/frontend
echo "VITE_TELEGRAM_BOT=TuUsuarioBot" > .env     # sin @
npm run dev                                      # reinícialo para que tome el cambio
```
En el **detalle de una reservación** aparece el enlace `t.me/TuUsuarioBot?start=CÓDIGO` con botón **Copiar**.

## Paso 6 · Prueba completa
1. Crea una reservación para hoy y confírmala.
2. Copia el enlace de Telegram del detalle y ábrelo en tu celular → **Iniciar**. El bot responde *"¡Listo…!"* con el resumen.
3. Haz el **check-in** → en menos de un minuto llega la bienvenida.
4. Registra un **pago** → llega el recibo.
5. Haz el **check-out** → al grupo de recepción llega *"🧹 La habitación … está lista para limpiar"*.

---

## Paso 7 · Asistente con IA para el personal (opcional)

Un segundo bot, **solo para el personal** (recepción, gerencia y admin), que responde preguntas en lenguaje natural con datos reales del sistema. Ejemplos:

| Rol | Pregunta | Herramienta que usa la IA |
|---|---|---|
| Recepción | "¿Cómo va el día?" | `resumen_dia` |
| Recepción | "¿Qué tengo libre del 20 al 23 de diciembre para 2 adultos?" | `disponibilidad` (precio con temporada) |
| Recepción | "¿Cuánto debe la reservación 5D48D61C?" | `reservacion` |
| Recepción | "Busca a Lucía Mendoza" | `buscar_huesped` |
| Recepción | "¿Qué tengo pendiente?" | `pendientes` |
| Gerente / admin | "¿Cuánto cobramos este mes y por qué medio?" | `ingresos` |
| Gerente / admin | "¿Qué ocupación tuvimos en octubre? ¿Por qué cancelan?" | `estadisticas` |
| Admin | "¿Falló algún aviso de Telegram?" | `avisos_fallidos` |

**Cómo se cuidan los datos y los tokens:**
- La IA **no escribe SQL**: elige una de esas 8 funciones y llena sus datos. Cada función regresa un texto corto ya resumido.
- El número de chat lo pone n8n desde el mensaje de Telegram, no la IA, y la función revisa en la BD el rol y el hotel de esa persona. Recepción nunca ve ingresos ni otro hotel.
- n8n se conecta con el usuario **`asistente_ro`**, que solo puede ejecutar esas funciones: no puede leer tablas ni modificar nada.
- `scripts/esquema_compacto.py` resume la BD (≈ 650 tokens en lugar de ≈ 17,000) y lo guarda en `asistente.contexto`, de donde n8n lo toma para el mensaje del sistema.

### 7.1 Base de datos
`setup_db.sh` ya lo hace. Si tu base ya existía, ejecuta una sola vez:
```bash
cd ~/proyectoI/hotel-pms
sudo -u postgres psql -c "CREATE ROLE asistente_ro LOGIN PASSWORD 'Asistente123';"
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE hotel_pms TO asistente_ro;"
PGPASSWORD=PI123 psql -h localhost -U pms_admin -d hotel_pms -f database/12_asistente.sql
python3 scripts/esquema_compacto.py          # imprime el resumen y cuántos tokens ahorra
```

### 7.2 Bot y llave de la IA
1. En **@BotFather** crea **otro** bot (por ejemplo `PersonalLosArcosBot`). No uses el de huéspedes: Node-RED ya lo está escuchando y Telegram solo permite un receptor por bot.
2. Saca una API key **gratis** de Gemini en https://aistudio.google.com/apikey.

### 7.3 n8n
1. El *Telegram Trigger* necesita una dirección pública. En una terminal:
   ```bash
   cloudflared tunnel --url http://localhost:5678     # copia el enlace https://….trycloudflare.com
   ```
   y arranca n8n con esa dirección (en otra terminal):
   ```bash
   WEBHOOK_URL=https://TU-ENLACE.trycloudflare.com/ n8n start
   ```
2. **Credenciales** nuevas:
   - *Telegram API* → nombre **Bot del personal**, con el token del bot nuevo.
   - *Postgres* → nombre **PMS Asistente (solo lectura)**: host `localhost`, base `hotel_pms`, usuario `asistente_ro`, contraseña `Asistente123`.
   - *Google Gemini (PaLM) API* → nombre **Google Gemini**, con tu API key.
3. *Workflows → Import from file* → `automation/n8n/asistente-personal.json`. Abre cada nodo con ⚠️ y elige la credencial.
4. Actívalo (interruptor **Active**).

### 7.4 Registrar al personal
1. Cada persona le escribe cualquier cosa al bot del personal. Como todavía no está registrada, el bot le contesta su **número de chat**.
2. En el sistema web, el administrador o gerente entra a **Personal → Editar** y pega ese número en *Chat de Telegram*.
3. Listo: ahora el bot le contesta según su rol.

> **Nota honesta:** este flujo no se pudo probar dentro de n8n en el entorno donde se programó; las funciones de la BD sí están probadas (`03_validar_reglas.sql`, RN-86 a RN-88). Si un nodo marca error al importar (cambia entre versiones de n8n), bórralo y agrégalo de nuevo con los mismos datos.

---

## Si algo no funciona

| Síntoma | Causa probable | Solución |
|---|---|---|
| El bot no contesta | Node-RED no está corriendo, el token está mal, u otro programa usa el mismo bot | Revisa la pestaña *debug* de Node-RED; desactiva cualquier Telegram Trigger de n8n con este bot |
| Node-RED dice `password authentication failed` | Faltan usuario y contraseña en el nodo de PostgreSQL | Paso 2.3 |
| No llegan los avisos al huésped | n8n no está activo, o el huésped no vinculó su Telegram | Activa el flujo; en el detalle debe decir *"✅ Recibe avisos"* |
| No llega el aviso de limpieza ni el resumen | El hotel no tiene `telegram_chat_id` | Paso 3 |
| El asistente no contesta | El flujo no está activo, falta `WEBHOOK_URL`, o se usó el mismo bot que Node-RED | Paso 7.2 y 7.3 |
| El asistente contesta "no está registrado" | El chat no está en el usuario | Paso 7.4 |
| El asistente dice que no conoce la BD | No se corrió el script | `python3 scripts/esquema_compacto.py` |
| Ver qué se envió y qué falló | — | `psql … -c "SELECT estado, destinatario, left(mensaje,40), error FROM notificaciones ORDER BY created_at DESC LIMIT 10;"` |
