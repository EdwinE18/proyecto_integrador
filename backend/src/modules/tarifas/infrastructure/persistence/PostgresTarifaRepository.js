import { TarifaRepository } from '../../domain/ports/TarifaRepository.js';
import { Temporada } from '../../domain/entities/Temporada.js';
import { TarifaError } from '../../domain/errors/TarifaError.js';
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const aTemporada = (f) => new Temporada({
  id: f.id, tipoId: f.tipo_id, nombre: f.nombre, fechaInicio: f.fecha_inicio, fechaFin: f.fecha_fin,
  precioNoche: Dinero.dePesos(f.precio_noche),
});
// Las fechas se piden como texto para que la zona horaria no las recorra
const COLS = `id, tipo_id, nombre, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin, precio_noche`;

export class PostgresTarifaRepository extends TarifaRepository {
  constructor(pool) { super(); this.pool = pool; }

  async listarPorHotel(hotelId) {
    const { rows: tipos } = await this.pool.query(
      `SELECT t.id, t.nombre, t.capacidad_adultos, t.capacidad_ninos, t.precio_base,
              (SELECT COUNT(*) FROM habitaciones h WHERE h.tipo_id = t.id AND h.activo)::int AS habitaciones
       FROM tipos_habitacion t WHERE t.hotel_id = $1 AND t.activo ORDER BY t.precio_base`, [hotelId]);
    const { rows: temps } = await this.pool.query(
      `SELECT ${COLS} FROM tarifas_temporada WHERE tipo_id = ANY($1::uuid[]) ORDER BY fecha_inicio`, [tipos.map((t) => t.id)]);
    return tipos.map((t) => ({
      id: t.id, nombre: t.nombre, capacidadAdultos: t.capacidad_adultos, capacidadNinos: t.capacidad_ninos,
      precioBase: Dinero.dePesos(t.precio_base), habitaciones: t.habitaciones,
      temporadas: temps.filter((s) => s.tipo_id === t.id).map(aTemporada),
    }));
  }

  async hotelDelTipo(tipoId) {
    if (!UUID.test(tipoId ?? '')) return null;
    const { rows: [f] } = await this.pool.query('SELECT hotel_id FROM tipos_habitacion WHERE id = $1', [tipoId]);
    return f?.hotel_id ?? null;
  }

  async buscarTemporada(id) {
    if (!UUID.test(id ?? '')) return null;
    const { rows: [f] } = await this.pool.query(
      `SELECT s.id, s.tipo_id, s.nombre, to_char(s.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
              to_char(s.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, s.precio_noche, t.hotel_id
       FROM tarifas_temporada s JOIN tipos_habitacion t ON t.id = s.tipo_id WHERE s.id = $1`, [id]);
    return f ? { temporada: aTemporada(f), hotelId: f.hotel_id } : null;
  }

  async guardarTemporada(t) {
    try {
      const { rows: [f] } = await this.pool.query(
        `INSERT INTO tarifas_temporada (tipo_id, nombre, fecha_inicio, fecha_fin, precio_noche)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`,
        [t.tipoId, t.nombre, t.fechaInicio, t.fechaFin, t.precioNoche.toString()]);
      return aTemporada(f);
    } catch (e) {
      if (e.code === '23P01') throw new TarifaError('Ya hay otra temporada para ese tipo de habitación en esas fechas', 'RN-60', 409);
      throw e;
    }
  }

  async eliminarTemporada(id) { await this.pool.query('DELETE FROM tarifas_temporada WHERE id = $1', [id]); }

  async actualizarPrecioBase(tipoId, dinero) {
    await this.pool.query('UPDATE tipos_habitacion SET precio_base = $2, updated_at = now() WHERE id = $1', [tipoId, dinero.toString()]);
  }
}
