// ADAPTADOR: lee de PostgreSQL los datos de la habitación que necesita una reservación.
import { HabitacionReader } from '../../domain/ports/HabitacionReader.js';

export class PostgresHabitacionReader extends HabitacionReader {
  constructor(pool) { super(); this.pool = pool; }

  async obtenerParaReservar(habitacionId) {
    const { rows } = await this.pool.query(
      `SELECT h.id, h.hotel_id, h.numero, h.estado, h.activo,
              t.capacidad_adultos, t.capacidad_ninos
       FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id
       WHERE h.id = $1`, [habitacionId]);
    const r = rows[0];
    return r ? {
      id: r.id, hotelId: r.hotel_id, numero: r.numero, estado: r.estado, activo: r.activo,
      capacidadAdultos: r.capacidad_adultos, capacidadNinos: r.capacidad_ninos,
    } : null;
  }
}
