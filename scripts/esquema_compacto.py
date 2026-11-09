#!/usr/bin/env python3
"""
Resume la base de datos en pocas líneas para el asistente de IA (gasta menos tokens).

En lugar de mandarle a la IA todo el SQL (≈ 40 000 caracteres) o pedirle que
explore la base, este script lee el catálogo de PostgreSQL una sola vez y escribe
un resumen compacto:  tabla(columna tipo, ...) → relaciones, valores de los enum
y las herramientas que la IA puede usar. El resumen se guarda en:
  · asistente.contexto (clave 'esquema')  → n8n lo lee y lo pone en el mensaje del sistema
  · docs/esquema_compacto.txt            → para revisarlo o entregarlo

Uso (no requiere instalar nada de pip; usa psql):
    python3 scripts/esquema_compacto.py
    python3 scripts/esquema_compacto.py --url postgres://pms_admin:PI123@localhost:5432/hotel_pms --solo-archivo
Vuelve a correrlo cada vez que cambies las tablas.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
URL_POR_OMISION = os.environ.get("DATABASE_URL", "postgres://pms_admin:PI123@localhost:5432/hotel_pms")

# Tablas que la IA no necesita conocer (técnicas o con datos sensibles)
OCULTAS = {"eventos_dominio", "notificaciones", "historial_habitacion", "acompanantes"}
# Columnas que nunca se mencionan (secretos, datos personales sensibles o ruido)
COLUMNAS_OCULTAS = {"password_hash", "num_documento", "fecha_nacimiento", "created_at", "updated_at", "telegram_chat_id", "amenidades"}

TIPOS_CORTOS = {
    "uuid": "id", "character varying": "texto", "text": "texto", "citext": "texto", "integer": "entero",
    "smallint": "entero", "bigint": "entero", "numeric": "dinero", "boolean": "sí/no", "date": "fecha",
    "time without time zone": "hora", "timestamp with time zone": "fecha-hora", "jsonb": "json",
}


def consultar(url, sql):
    """Ejecuta SQL con psql y regresa filas como listas (separador |)."""
    r = subprocess.run(["psql", url, "-X", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"❌ Error de psql: {r.stderr.strip()}\n   Revisa la conexión: {url.split('@')[-1]}")
    return [linea.split("|") for linea in r.stdout.splitlines() if linea]


def construir(url):
    columnas = consultar(url, """
        SELECT c.table_name, c.column_name, c.data_type, c.udt_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name, c.ordinal_position""")
    relaciones = consultar(url, """
        SELECT tc.table_name, kcu.column_name, ccu.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'""")
    enums = consultar(url, """
        SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname ORDER BY 1""")
    herramientas = consultar(url, """
        SELECT p.proname, pg_get_function_arguments(p.oid), COALESCE(obj_description(p.oid, 'pg_proc'), '')
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'asistente' AND p.proname NOT LIKE '\\_%' AND p.proname <> 'identificar' ORDER BY 1""")

    fk = {(t, c): destino for t, c, destino in relaciones}
    tablas = {}
    for tabla, col, tipo, udt in columnas:
        if tabla in OCULTAS or col in COLUMNAS_OCULTAS or col == "id":
            continue
        if (tabla, col) in fk:
            corto = f"→{fk[(tabla, col)]}"
        elif tipo == "USER-DEFINED":
            corto = "texto" if udt == "citext" else udt   # enum: sus valores van abajo
        else:
            corto = TIPOS_CORTOS.get(tipo, tipo)
        tablas.setdefault(tabla, []).append(f"{col} {corto}")

    lineas = ["BD hotel_pms (PostgreSQL). Dinero en MXN. Fechas AAAA-MM-DD; la salida no cuenta como noche.", "Tablas:"]
    lineas += [f"- {t}({', '.join(cols)})" for t, cols in tablas.items()]
    lineas.append("Valores:")
    lineas += [f"- {nombre}: {valores}" for nombre, valores in enums]
    lineas.append("Reglas: no hay sobreventa (la BD lo impide); saldo = total - pagos; recepción no ve ingresos.")
    if herramientas:
        lineas.append("Herramientas (todas reciben el chat automáticamente):")
        def limpiar(a):
            a = a.replace("p_chat text, ", "").replace("p_chat text", "").replace("::text", "")
            return a.replace(" DEFAULT ", "=").replace("p_", "")
        lineas += [f"- {n}({limpiar(args)})" for n, args, _ in herramientas]
    return "\n".join(lineas)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=URL_POR_OMISION, help="cadena de conexión (por omisión DATABASE_URL o la local)")
    ap.add_argument("--solo-archivo", action="store_true", help="no guardar en la tabla asistente.contexto")
    args = ap.parse_args()

    texto = construir(args.url)
    salida = RAIZ / "docs" / "esquema_compacto.txt"
    salida.write_text(texto + "\n", encoding="utf-8")

    if not args.solo_archivo:
        # $txt$ evita problemas con comillas dentro del texto
        consultar(args.url, f"""INSERT INTO asistente.contexto (clave, texto) VALUES ('esquema', $txt${texto}$txt$)
                                ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, actualizado = now()""")

    sql_completo = sum(len(p.read_text(encoding="utf-8")) for p in (RAIZ / "database").glob("0*.sql"))
    print(texto)
    print("\n" + "─" * 60)
    print(f"✅ Guardado en {salida.relative_to(RAIZ)}" + ("" if args.solo_archivo else " y en asistente.contexto"))
    print(f"   Resumen: {len(texto):,} caracteres ≈ {len(texto) // 4:,} tokens")
    print(f"   El SQL completo serían {sql_completo:,} caracteres ≈ {sql_completo // 4:,} tokens "
          f"(ahorro de {100 - 100 * len(texto) // max(sql_completo, 1)} % en cada mensaje)")


if __name__ == "__main__":
    main()
