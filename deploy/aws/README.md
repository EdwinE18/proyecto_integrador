# Despliegue en AWS (AWS Academy Learner Lab)

Resultado: el sistema queda en internet en `http://<IP pública>`, con la base de datos en **RDS PostgreSQL**, la página y la API en un servidor **EC2**, y el bot del hotel funcionando en Telegram.

```
Navegador ──► EC2 (Ubuntu 24.04)                      ──►  RDS PostgreSQL 16
              ├─ nginx :80  → página React                (puerto 5432, privado,
              ├─ pms-api    → Node.js :3000 (/api)          solo desde el EC2, con SSL)
              └─ pms-bot    → Node-RED: bot del hotel,
                              resumen 8:00 y avisos  ──►  Telegram
```

Tiempo: unos 30 minutos (RDS tarda ~10 en crearse).

> **Antes de empezar:** sube a GitHub tu última versión (`git push`). El servidor descarga el código desde ahí.

---

## 1. Iniciar el laboratorio

1. En AWS Academy entra a tu curso → **Modules** → **Launch AWS Academy Learner Lab**.
2. Clic en **Start Lab**. Espera a que el círculo junto a *AWS* se ponga **verde**.
3. Clic en **AWS** (se abre la consola). Revisa arriba a la derecha que la región sea **N. Virginia (us-east-1)**.

> El laboratorio dura unas 4 horas por sesión. Al terminar, AWS **apaga** el servidor (no lo borra). Ver la sección 7.

## 2. Crear el servidor EC2

**EC2 → Instances → Launch instances:**

| Campo | Valor |
|---|---|
| Name | `hotel-pms-web` |
| Application and OS Images | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **t3.small** (2 GB de RAM; con t3.micro la compilación puede quedarse sin memoria) |
| Key pair | `vockey` |
| Network settings → Edit | Crear grupo de seguridad `pms-web`: **SSH (22)** desde *My IP* y **HTTP (80)** desde *Anywhere* (0.0.0.0/0) |
| Configure storage | **20 GiB** gp3 |

Clic en **Launch instance**. Espera a que diga *Running* y anota su **Public IPv4 address**.

## 3. Crear la base de datos RDS

**RDS → Databases → Create database:**

| Campo | Valor |
|---|---|
| Creation method | **Standard create** |
| Engine | **PostgreSQL**, versión **16.x** |
| Templates | **Free tier** (o *Dev/Test*) |
| DB instance identifier | `hotel-pms-db` |
| Master username | `postgres` |
| Master password | una contraseña tuya (anótala) |
| Instance class | **db.t3.micro** |
| Storage | 20 GiB gp2, **sin** *storage autoscaling* |
| Connectivity → Compute resource | **Connect to an EC2 compute resource** → elige `hotel-pms-web` (AWS crea solo los grupos de seguridad del puerto 5432) |
| Public access | **No** |
| Monitoring | Desactiva **Enhanced Monitoring** y **Performance Insights** (el laboratorio no permite crear sus permisos) |
| Additional configuration | Backup retention **1 día**; desmarca *Enable deletion protection* |

Clic en **Create database**. Cuando el estado sea **Available**, abre la base y copia el **Endpoint** (algo como `hotel-pms-db.abc123.us-east-1.rds.amazonaws.com`).

> No hace falta crear la base `hotel_pms`: el script la crea.

## 4. Instalar el sistema en el EC2

1. **EC2 → Instances →** selecciona `hotel-pms-web` → **Connect** → pestaña **EC2 Instance Connect** → **Connect**. Se abre una terminal en el navegador.
2. Copia y pega:

```bash
sudo git clone https://github.com/EdwinE18/proyecto_integrador.git /opt/hotel-pms
cd /opt/hotel-pms
sudo bash deploy/aws/instalar.sh
```

3. El script pregunta:

| Pregunta | Respuesta |
|---|---|
| ¿Dónde va la base de datos? | `1` (RDS) |
| Endpoint de RDS | el que copiaste en el paso 3 |
| Usuario maestro | `postgres` |
| Contraseña maestra | la del paso 3 (no se ve al escribirla) |
| ¿Cargar datos de demostración? | `s` |
| Usuario del bot | el de tu bot del hotel, sin `@` |
| Token del bot | el de @BotFather (no se ve al escribirlo) |

Tarda de 5 a 10 minutos. Al final muestra:

```
✅ PMS instalado.
   Abre:  http://54.xx.xx.xx
```

4. Abre esa dirección en tu navegador y entra con `admin@pms.local` / `Demo1234`.

> **Importante:** el bot del hotel solo puede estar conectado en **un** lugar. Si Node-RED está corriendo en tu computadora con el mismo bot, ciérralo; si no, los mensajes se reparten entre los dos.

## 5. Probar

| Qué | Cómo |
|---|---|
| Página | `http://<IP>` → entra con cada rol (admin, gerente, recepción, limpieza; contraseña `Demo1234`) |
| API | `http://<IP>/api/health` (responde `{"ok":true}`) |
| Bot | En Telegram escríbele `hola` a tu bot → `2` → haz una reservación |
| Avisos | En **Hotel y tarifas** pon tu número de chat (te lo da `/miid` en el bot) en *Chat de Telegram de recepción*; manda un cuarto a mantenimiento: en menos de un minuto te llega el aviso |

## 6. Comandos útiles en el servidor

```bash
sudo systemctl status pms-api pms-bot nginx     # ¿están funcionando?
sudo journalctl -u pms-api -n 50                # últimos registros de la API
sudo journalctl -u pms-bot -f                   # registros del bot en vivo
sudo systemctl restart pms-api pms-bot          # reiniciar
cd /opt/hotel-pms && sudo bash deploy/aws/actualizar.sh   # bajar cambios de GitHub y reinstalar
sudo cat /root/pms-credenciales.txt             # contraseñas generadas (base de datos, JWT)
```

Recrear los datos de demostración con la fecha de hoy (el día de la presentación):

```bash
cd /opt/hotel-pms
sudo bash -c 'source <(grep -E "^[A-Z_]+=" /root/pms-credenciales.txt); PGPASSWORD=$DB_PASS PGSSLMODE=require \
  psql -h $RDS_HOST -U pms_admin -d hotel_pms -f database/10_datos_demo.sql'
```

## 7. Cuando termina la sesión del laboratorio

- AWS **apaga** el EC2 (y puede detener RDS). Los datos **no se pierden**.
- Al volver: **Start Lab** → en EC2, si `hotel-pms-web` está *Stopped*, **Instance state → Start**. En RDS, si está *Stopped*, **Actions → Start**.
- Los servicios arrancan solos, pero la **IP pública cambia**: búscala de nuevo en EC2.
- Si quieres una IP fija: **EC2 → Elastic IPs → Allocate** → **Associate** con `hotel-pms-web`.

## 8. Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| `No me pude conectar a RDS` | El EC2 no tiene permiso al puerto 5432, o el endpoint/contraseña están mal | En RDS → *Connectivity & security* → *Connected compute resources* debe aparecer `hotel-pms-web`. Si no: **Actions → Set up EC2 connection** |
| La página no abre | Falta el puerto 80 en el grupo de seguridad `pms-web` | EC2 → Security groups → `pms-web` → *Inbound rules* → agrega **HTTP 0.0.0.0/0** |
| La página abre pero no deja entrar | La API no arrancó | `sudo journalctl -u pms-api -n 50` |
| El bot no contesta | Token equivocado, o el mismo bot corre en tu computadora | `sudo journalctl -u pms-bot -n 50`; cierra el Node-RED local |
| `npm ... Killed` al compilar | Poca memoria (t3.micro) | Cambia a t3.small: *Instance state → Stop* → *Actions → Instance settings → Change instance type* |
| Sin RDS (para ahorrar crédito) | — | Corre el script y elige `2`: PostgreSQL se instala en el mismo EC2 |

## Qué hace `instalar.sh`

1. Instala Node.js 22, nginx y el cliente de PostgreSQL; pone la zona horaria de México.
2. Crea en RDS los usuarios `pms_admin` (la aplicación) y `asistente_ro` (solo consultas, para la IA), la base `hotel_pms` con zona horaria de México, y carga tablas, reglas, funciones, bot y datos de demostración.
3. Conecta con **SSL verificado** usando el certificado oficial de Amazon RDS.
4. Instala la API como servicio `pms-api` (arranca sola y se reinicia si falla).
5. Compila la página React y la publica con nginx: `/` es la página y `/api` va a la API.
6. Configura Node-RED **sin abrir su editor**: el bot de huéspedes, el resumen de las 8:00 y los avisos (en el servidor, Node-RED hace lo que n8n hace en la computadora de desarrollo).
7. Genera contraseñas aleatorias para la base y las sesiones, y las guarda en `/root/pms-credenciales.txt` (solo root).

Se puede volver a correr sin perder datos.
