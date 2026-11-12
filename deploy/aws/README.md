# Despliegue en AWS (AWS Academy Learner Lab)

El sistema queda en internet en `http://<IP pública del frontend>`, repartido en **dos servidores EC2**:

```
                    internet (puerto 80)
Navegador ──────────────────────────────►  EC2 FRONTEND  (hotel-pms-front)
                                            nginx: página React
                                            /api ──┐
                                                   │ red privada de AWS (puerto 3000)
                                                   ▼
                                           EC2 BACKEND + BASE DE DATOS  (hotel-pms-back)
                                            pms-api  → Node.js :3000
                                            PostgreSQL 16 :5432 (solo local)
                                            pms-bot  → Node-RED: bot del hotel,  ──► Telegram
                                                       resumen 8:00 y avisos
```

- **Frontend:** solo publica la página. El navegador nunca habla directo con el backend: nginx le pasa `/api` por la red privada.
- **Backend + base de datos:** no se expone a internet. Su puerto 3000 solo acepta conexiones del frontend, y PostgreSQL solo escucha dentro del mismo servidor.

El mismo script (`instalar.sh`) sirve para los dos: al empezar pregunta cuál servidor es. También puede instalar todo en uno solo (opción 3), o usar RDS como base de datos (ver el final).

Tiempo: unos 30 minutos.

> **Antes de empezar:** sube a GitHub tu última versión (`git push`). Los servidores descargan el código desde ahí.

---

## 1. Iniciar el laboratorio

1. En AWS Academy entra a tu curso → **Modules** → **Launch AWS Academy Learner Lab**.
2. Clic en **Start Lab**. Espera a que el círculo junto a *AWS* se ponga **verde**.
3. Clic en **AWS** (se abre la consola). Revisa arriba a la derecha que la región sea **N. Virginia (us-east-1)**.

> El laboratorio dura unas 4 horas por sesión. Al terminar, AWS **apaga** los servidores (no los borra). Ver la sección 7.

## 2. Servidor BACKEND + base de datos

**EC2 → Instances → Launch instances:**

| Campo | Valor |
|---|---|
| Name | `hotel-pms-back` |
| Application and OS Images | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **t3.small** (2 GB de RAM: PostgreSQL, la API y el bot) |
| Key pair | `vockey` |
| Network settings → **Edit** | *Create security group*, nombre **`pms-back`**. Deja solo la regla **SSH (22)** con *Source type* **My IP**. (El puerto 3000 se agrega en el paso 4.) |
| Configure storage | **20 GiB** gp3 |

Clic en **Launch instance**. Cuando diga *Running*, ábrela y anota su **Private IPv4 address** (empieza con `172.31.`).

**Instalar:** con `hotel-pms-back` seleccionada → **Connect** → pestaña **EC2 Instance Connect** → **Connect**. En la terminal que se abre:

```bash
sudo git clone https://github.com/EdwinE18/proyecto_integrador.git /opt/hotel-pms
cd /opt/hotel-pms && sudo bash deploy/aws/instalar.sh
```

| Pregunta | Respuesta |
|---|---|
| ¿Qué servidor es este? | `1` (backend + base de datos) |
| ¿Dónde va la base de datos? | `2` (en este mismo servidor) |
| ¿Cargar datos de demostración? | `s` |
| Usuario del bot | el de tu bot del hotel, sin `@` |
| Token del bot | el de @BotFather (no se ve al escribirlo) |

Tarda unos 5 minutos y termina con:

```
✅ Backend + base de datos instalados.
   IP PRIVADA de este servidor:  172.31.xx.xx
```

> **El bot solo puede estar conectado en un lugar.** Si Node-RED sigue corriendo en tu computadora con el mismo bot, ciérralo (Ctrl+C).

## 3. Servidor FRONTEND

**EC2 → Launch instances** otra vez:

| Campo | Valor |
|---|---|
| Name | `hotel-pms-front` |
| Imagen | **Ubuntu Server 24.04 LTS** |
| Instance type | **t3.small** (compilar la página necesita memoria; después podría bajar a t3.micro) |
| Key pair | `vockey` |
| Network settings → **Edit** | *Create security group*, nombre **`pms-front`**: **SSH (22)** desde **My IP** y **HTTP (80)** desde **Anywhere (0.0.0.0/0)** |
| Storage | **20 GiB** |

## 4. Abrir el puerto 3000 del backend solo para el frontend

**EC2 → Security Groups →** `pms-back` → **Edit inbound rules → Add rule**:

| Type | Port | Source |
|---|---|---|
| Custom TCP | **3000** | **Custom** → escribe `pms-front` y elige ese grupo de seguridad |

**Save rules.** Así, solo el servidor frontend puede hablar con la API; nadie más desde internet.

## 5. Instalar el frontend

**Connect** a `hotel-pms-front` → **EC2 Instance Connect**:

```bash
sudo git clone https://github.com/EdwinE18/proyecto_integrador.git /opt/hotel-pms
cd /opt/hotel-pms && sudo bash deploy/aws/instalar.sh
```

| Pregunta | Respuesta |
|---|---|
| ¿Qué servidor es este? | `2` (frontend) |
| IP privada del backend | la que te dio el paso 2 (`172.31.xx.xx`) |
| Usuario del bot | el mismo (sirve para el botón "Abrir en Telegram" de la página) |

Debe mostrar `✔ El backend responde en 172.31.xx.xx:3000` y al final:

```
✅ PMS instalado.
   Abre:  http://54.xx.xx.xx
```

Abre esa dirección y entra con `admin@pms.local` / `Demo1234`.

## 6. Probar

| Qué | Cómo |
|---|---|
| Página | `http://<IP del frontend>` → entra con cada rol (admin, gerente, recepción, limpieza; contraseña `Demo1234`) |
| API a través del frontend | `http://<IP del frontend>/api/health` → `{"ok":true}` |
| El backend NO está expuesto | `http://<IP pública del backend>:3000` no debe abrir |
| Bot | En Telegram escríbele `hola` a tu bot → `2` → haz una reservación |
| Avisos | En **Hotel y tarifas** pon tu número de chat (te lo da `/miid` en el bot) en *Chat de Telegram de recepción*; manda un cuarto a mantenimiento: en menos de un minuto te llega el aviso |

## 7. Comandos útiles

En el **backend**:

```bash
sudo systemctl status pms-api pms-bot postgresql   # ¿están funcionando?
sudo journalctl -u pms-api -n 50                   # últimos registros de la API
sudo journalctl -u pms-bot -f                      # registros del bot en vivo
sudo systemctl restart pms-api pms-bot             # reiniciar
sudo -u postgres psql hotel_pms                    # entrar a la base de datos
sudo cat /root/pms-credenciales.txt                # contraseñas generadas
```

Recrear los datos de demostración con la fecha de hoy (el día de la presentación), en el backend:

```bash
sudo -u postgres psql hotel_pms -f /opt/hotel-pms/database/10_datos_demo.sql
```

En el **frontend**:

```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

Actualizar después de un `git push` (en cada servidor; reutiliza las respuestas guardadas):

```bash
cd /opt/hotel-pms && sudo bash deploy/aws/actualizar.sh
```

## 8. Cuando termina la sesión del laboratorio

- AWS **apaga** los EC2. Los datos **no se pierden**.
- Al volver: **Start Lab** → EC2 → selecciona los dos servidores → **Instance state → Start**.
- Los servicios arrancan solos. La **IP pública cambia** (búscala de nuevo); la **IP privada no cambia**, así que el frontend sigue encontrando al backend.
- Para una IP pública fija: **EC2 → Elastic IPs → Allocate** → **Associate** con `hotel-pms-front`.

## 9. Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| El frontend dice `No pude llegar al backend` | Falta la regla del paso 4, o la IP privada está mal | Revisa `pms-back` → *Inbound rules* (3000 desde `pms-front`) y la *Private IPv4* del backend; luego en el frontend: `sudo bash deploy/aws/instalar.sh` |
| La página no abre | Falta el puerto 80 en `pms-front` | EC2 → Security groups → `pms-front` → agrega **HTTP 0.0.0.0/0** |
| La página abre pero no deja entrar | La API no responde | En el backend: `sudo journalctl -u pms-api -n 50` |
| El bot no contesta | Token equivocado, o el mismo bot corre en tu computadora | En el backend: `sudo journalctl -u pms-bot -n 50`; cierra el Node-RED local |
| `npm ... Killed` al compilar | Poca memoria | Usa t3.small: *Instance state → Stop* → *Actions → Instance settings → Change instance type* |

## Variantes

- **Todo en un solo servidor:** crea un EC2 con los puertos 22 y 80, y en `instalar.sh` elige `3`.
- **Base de datos en RDS** (como pide la ficha original): crea en RDS una base PostgreSQL 16 (*Standard create*, *Free tier*, db.t3.micro, *Connect to an EC2 compute resource* → `hotel-pms-back`, sin Enhanced Monitoring). En el backend, al correr `instalar.sh`, elige base de datos `1` y da el endpoint, el usuario (`postgres`) y la contraseña maestra. La conexión va cifrada con el certificado oficial de Amazon RDS.

## Qué hace `instalar.sh`

**En el backend (opción 1):**
1. Instala Node.js 22 y PostgreSQL 16; pone la zona horaria de México.
2. Crea los usuarios `pms_admin` (la aplicación) y `asistente_ro` (solo consultas, para la IA) con contraseñas aleatorias, la base `hotel_pms` con zona horaria de México, y carga tablas, reglas, funciones, bot y datos de demostración.
3. Instala la API como servicio `pms-api` (arranca sola y se reinicia si falla).
4. Configura Node-RED **sin abrir su editor** (servicio `pms-bot`): el bot de huéspedes, el resumen de las 8:00 y los avisos. En el servidor, Node-RED hace lo que n8n hace en la computadora de desarrollo.

**En el frontend (opción 2):**
1. Instala Node.js 22 y nginx.
2. Compila la página React y la publica en `/var/www/hotel-pms`.
3. Configura nginx: `/` es la página y `/api` se reenvía a `IP-privada-del-backend:3000`. Comprueba que el backend responda.

Las contraseñas generadas quedan en `/root/pms-credenciales.txt` (solo root). El script se puede volver a correr sin perder datos.
