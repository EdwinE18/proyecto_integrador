# 🤖 Automatizaciones: Telegram con n8n y Node-RED

| Pieza | Archivo | Qué hace |
|---|---|---|
| **PostgreSQL** | `database/09_notificaciones.sql` | Arma los mensajes y decide a quién van (RN-81, 82, 84, 85) |
| **n8n** | `automation/n8n/notificaciones-telegram.json` | Cada minuto envía los avisos pendientes |
| **Node-RED** | `automation/node-red/flows.json` | El bot conversa con el huésped y manda el resumen de las 8:00 a recepción |

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
psql -h localhost -U pms_admin -d hotel_pms -f database/09_notificaciones.sql
```

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
5. **Prueba:** escríbele `hola` a tu bot en Telegram. Debe contestar *"¡Hola…! Soy el asistente del hotel…"*.

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

## Si algo no funciona

| Síntoma | Causa probable | Solución |
|---|---|---|
| El bot no contesta | Node-RED no está corriendo, el token está mal, u otro programa usa el mismo bot | Revisa la pestaña *debug* de Node-RED; desactiva cualquier Telegram Trigger de n8n con este bot |
| Node-RED dice `password authentication failed` | Faltan usuario y contraseña en el nodo de PostgreSQL | Paso 2.3 |
| No llegan los avisos al huésped | n8n no está activo, o el huésped no vinculó su Telegram | Activa el flujo; en el detalle debe decir *"✅ Recibe avisos"* |
| No llega el aviso de limpieza ni el resumen | El hotel no tiene `telegram_chat_id` | Paso 3 |
| Ver qué se envió y qué falló | — | `psql … -c "SELECT estado, destinatario, left(mensaje,40), error FROM notificaciones ORDER BY created_at DESC LIMIT 10;"` |
