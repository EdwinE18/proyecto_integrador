// ADAPTADOR: lee la estructura y los datos desde PostgreSQL (catálogo information_schema).
import { EsquemaRepository } from '../../domain/ports/EsquemaRepository.js';

const comillas = (id) => '"' + id.replace(/"/g, '""') + '"';

export class PostgresEsquemaRepository extends EsquemaRepository {
  constructor(pool) { super(); this.pool = pool; }

  async listarTablas() {
    const { rows } = await this.pool.query(`
      SELECT c.relname AS nombre,
             c.reltuples::bigint AS aprox,
             obj_description(c.oid) AS descripcion,
             (SELECT count(*) FROM information_schema.columns col
               WHERE col.table_schema = 'public' AND col.table_name = c.relname)::int AS columnas
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`);
    // Conteo exacto de filas (son pocas tablas)
    for (const t of rows) {
      const r = await this.pool.query(`SELECT count(*)::int AS n FROM public.${comillas(t.nombre)}`);
      t.filas = r.rows[0].n;
      delete t.aprox;
    }
    return rows;
  }

  async describirTabla(nombre) {
    const columnas = (await this.pool.query(`
      SELECT c.column_name AS nombre,
             CASE WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                  WHEN c.character_maximum_length IS NOT NULL
                       THEN c.data_type || '(' || c.character_maximum_length || ')'
                  ELSE c.data_type END AS tipo,
             c.is_nullable = 'YES' AS nulo,
             c.column_default AS defecto,
             EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                     JOIN information_schema.key_column_usage k
                       ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema
                     WHERE tc.table_schema = 'public' AND tc.table_name = c.table_name
                       AND tc.constraint_type = 'PRIMARY KEY' AND k.column_name = c.column_name) AS pk
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position`, [nombre])).rows;

    const relaciones = (await this.pool.query(`
      SELECT con.conname AS nombre,
             src.relname AS tabla_origen, a.attname AS columna_origen,
             dst.relname AS tabla_destino, b.attname AS columna_destino
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_class dst ON dst.oid = con.confrelid
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      JOIN pg_attribute b ON b.attrelid = con.confrelid AND b.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND (src.relname = $1 OR dst.relname = $1)
      ORDER BY src.relname`, [nombre])).rows;

    const reglas = (await this.pool.query(`
      SELECT con.conname AS nombre,
             CASE con.contype WHEN 'c' THEN 'CHECK' WHEN 'u' THEN 'UNIQUE'
                              WHEN 'x' THEN 'EXCLUDE' WHEN 'p' THEN 'PRIMARY KEY' END AS tipo,
             pg_get_constraintdef(con.oid) AS definicion
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      WHERE c.relname = $1 AND con.contype IN ('c','u','x')
      ORDER BY con.contype DESC, con.conname`, [nombre])).rows;

    const fks = new Map(relaciones.filter((r) => r.tabla_origen === nombre)
      .map((r) => [r.columna_origen, `${r.tabla_destino}.${r.columna_destino}`]));
    columnas.forEach((c) => { c.fk = fks.get(c.nombre) ?? null; });

    return { columnas, relaciones, reglas };
  }

  async obtenerFilas(nombre, { limite, desplazamiento }) {
    const t = `public.${comillas(nombre)}`;
    const total = (await this.pool.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
    const { rows } = await this.pool.query(`SELECT * FROM ${t} LIMIT $1 OFFSET $2`, [limite, desplazamiento]);
    return { total, filas: rows };
  }
}
