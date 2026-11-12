#!/usr/bin/env python3
"""
Prepara Node-RED para el servidor (AWS) sin tener que abrir su editor:

  · Toma automation/node-red/flows.json (bot de huéspedes + resumen de las 8:00).
  · La conexión a PostgreSQL se lee de variables de entorno (PGHOST, PGUSER, ...),
    con SSL si la base es RDS.
  · Agrega el grupo ③ "Avisos": cada minuto toma las notificaciones pendientes y las
    manda por Telegram (lo mismo que hace n8n en la computadora de desarrollo).
  · Escribe el token del bot en flows_cred.json (sin cifrar; el archivo queda con
    permisos 600 y el editor de Node-RED solo escucha en 127.0.0.1).

Uso:  python3 preparar_node_red.py <carpeta_destino> <usuario_del_bot>   (token en la variable BOT_TOKEN)
"""
import json
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "automation" / "node-red" / "flows.json"


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    destino = Path(sys.argv[1])
    usuario_bot = sys.argv[2].lstrip("@")
    token = os.environ.get("BOT_TOKEN", "").strip()
    usar_ssl = os.environ.get("DB_SSL", "false") == "true"
    if not token:
        sys.exit("Falta la variable BOT_TOKEN con el token de @BotFather")

    flujos = json.loads(ORIGEN.read_text(encoding="utf-8"))
    pestana = next(n["id"] for n in flujos if n["type"] == "tab")
    bot = next(n for n in flujos if n["type"] == "telegram bot")
    bd = next(n for n in flujos if n["type"] == "postgreSQLConfig")

    # Bot: su usuario (el token va en las credenciales)
    bot["botname"] = usuario_bot

    # Base de datos: todo desde variables de entorno del servicio (systemd)
    bd.update({
        "host": "PGHOST", "hostFieldType": "env",
        "port": "PGPORT", "portFieldType": "env",
        "database": "PGDATABASE", "databaseFieldType": "env",
        "user": "PGUSER", "userFieldType": "env",
        "password": "PGPASSWORD", "passwordFieldType": "env",
        "ssl": "true" if usar_ssl else "false", "sslFieldType": "bool",
    })

    # ③ Avisos por Telegram (reemplaza a n8n en el servidor)
    def nodo(id_, tipo, **campos):
        return {"id": id_, "type": tipo, "z": pestana, **campos}

    flujos += [
        nodo("a0c0000000000001", "comment", name="③ Avisos por Telegram (cada minuto; en el servidor reemplaza a n8n)",
             info="", x=270, y=400, wires=[]),
        nodo("a0c0000000000002", "inject", name="Cada minuto", props=[], repeat="60", crontab="", once=True,
             onceDelay="15", topic="", x=130, y=450, wires=[["a0c0000000000003"]]),
        nodo("a0c0000000000003", "postgresql", name="fn_tomar_notificaciones",
             query="SELECT * FROM fn_tomar_notificaciones(20);", postgreSQLConfig=bd["id"],
             split=False, rowsPerMsg=1, outputs=1, x=360, y=450, wires=[["a0c0000000000004"]]),
        nodo("a0c0000000000004", "function", name="Un mensaje por aviso",
             func=("const avisos = Array.isArray(msg.payload) ? msg.payload : [];\n"
                   "if (avisos.length === 0) return null;\n"
                   "// El chat y el texto ya los armó PostgreSQL (09_notificaciones.sql)\n"
                   "return [avisos.map((a) => ({ evento: a.evento_id,\n"
                   "  payload: { chatId: a.chat_id, type: 'message', content: a.mensaje } }))];"),
             outputs=1, timeout=0, noerr=0, initialize="", finalize="", libs=[], x=600, y=450,
             wires=[["a0c0000000000005"]]),
        nodo("a0c0000000000005", "telegram sender", name="Enviar aviso", bot=bot["id"], haserroroutput=True,
             outputs=2, x=800, y=450, wires=[["a0c0000000000006"], ["a0c0000000000007"]]),
        nodo("a0c0000000000006", "function", name="Enviado",
             func="msg.params = [msg.evento, true, null];\nreturn msg;",
             outputs=1, timeout=0, noerr=0, initialize="", finalize="", libs=[], x=990, y=430,
             wires=[["a0c0000000000008"]]),
        nodo("a0c0000000000007", "function", name="Falló (se reintenta)",
             func=("const error = msg.error?.message ?? String(msg.payload?.error ?? 'error de Telegram');\n"
                   "msg.params = [msg.evento, false, error.slice(0, 300)];\nreturn msg;"),
             outputs=1, timeout=0, noerr=0, initialize="", finalize="", libs=[], x=1010, y=480,
             wires=[["a0c0000000000008"]]),
        nodo("a0c0000000000008", "postgresql", name="fn_registrar_envio",
             query="SELECT fn_registrar_envio($1, $2, $3);", postgreSQLConfig=bd["id"],
             split=False, rowsPerMsg=1, outputs=1, x=1220, y=450, wires=[[]]),
    ]

    destino.mkdir(parents=True, exist_ok=True)
    (destino / "flows.json").write_text(json.dumps(flujos, ensure_ascii=False, indent=2), encoding="utf-8")
    cred = destino / "flows_cred.json"
    cred.write_text(json.dumps({bot["id"]: {"token": token}}), encoding="utf-8")
    os.chmod(cred, 0o600)
    print(f"Node-RED listo en {destino} ({len(flujos)} nodos, bot @{usuario_bot}, SSL {'sí' if usar_ssl else 'no'})")


if __name__ == "__main__":
    main()
