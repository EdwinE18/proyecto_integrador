import { HuespedRepository } from '../../domain/ports/HuespedRepository.js';
import { Huesped } from '../../domain/entities/Huesped.js';
import { HuespedError } from '../../domain/errors/HuespedError.js';

const COLUMNAS = ['nombre', 'apellidos', 'email', 'telefono', 'tipo_documento', 'num_documento',
  'nacionalidad', 'fecha_nacimiento', 'ciudad_origen', 'telegram_chat_id', 'notas'];
const valores = (h) => [h.nombre, h.apellidos, h.email, h.telefono, h.tipoDocumento, h.numDocumento,
  h.nacionalidad, h.fechaNacimiento, h.ciudadOrigen, h.telegramChatId, h.notas];

const aEntidad = (f) => new Huesped({
  id: f.id, nombre: f.nombre, apellidos: f.apellidos, email: f.email, telefono: f.telefono,
  tipoDocumento: f.tipo_documento, numDocumento: f.num_documento, nacionalidad: f.nacionalidad,
  fechaNacimiento: f.fecha_nacimiento, ciudadOrigen: f.ciudad_origen, telegramChatId: f.telegram_chat_id, notas: f.notas,
});

const traducirError = (e) => {
  if (e.code === '23505' && /tipo_documento/.test(e.constraint ?? ''))       // RN-30
    return new HuespedError('Ya existe un huésped con ese documento', 'RN-30', 409);
  const regla = e.code === '23514' && /(rn3\d)/i.exec(e.constraint ?? '');
  if (regla) return new HuespedError('Datos del huésped inválidos', regla[1].toUpperCase().replace('RN', 'RN-'));
  return e;
};

export class PostgresHuespedRepository extends HuespedRepository {
  constructor(pool) { super(); this.pool = pool; }

  async guardar(h) {
    try {
      const { rows: [f] } = await this.pool.query(
        `INSERT INTO huespedes (${COLUMNAS.join(', ')}) VALUES (${COLUMNAS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        valores(h));
      return aEntidad(f);
    } catch (e) { throw traducirError(e); }
  }

  async actualizar(h) {
    try {
      const { rows: [f] } = await this.pool.query(
        `UPDATE huespedes SET ${COLUMNAS.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
        [h.id, ...valores(h)]);
      return f ? aEntidad(f) : null;
    } catch (e) { throw traducirError(e); }
  }

  async buscarPorId(id) {
    const { rows: [f] } = await this.pool.query('SELECT * FROM huespedes WHERE id = $1', [id]);
    return f ? aEntidad(f) : null;
  }

  // Búsqueda para recepción: usa funciones de cadena (CONCAT, ILIKE, REGEXP_REPLACE).
  // Los valores van como $1 / $2 (nunca pegados al SQL) para evitar inyección SQL.
  async buscar(texto, limite) {
    const patron = `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
    const digitos = texto.replace(/\D/g, '');
    const { rows } = await this.pool.query(
      `SELECT * FROM huespedes
       WHERE CONCAT(nombre, ' ', apellidos) ILIKE $1
          OR email ILIKE $1
          OR num_documento ILIKE $1
          OR (length($2) >= 4 AND telefono LIKE '%' || $2 || '%')
       ORDER BY apellidos, nombre
       LIMIT $3`, [patron, digitos, limite]);
    return rows.map(aEntidad);
  }
}
