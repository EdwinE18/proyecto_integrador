// ADAPTADOR DE SALIDA: implementa el puerto usando PostgreSQL.
import { ReservacionRepository } from '../../domain/ports/ReservacionRepository.js';
import { Reservacion } from '../../domain/entities/Reservacion.js';
import { HabitacionNoDisponibleError, ReservacionError } from '../../domain/errors/ReservacionError.js';

const aEntidad = (r) => new Reservacion({
  id: r.id, codigo: r.codigo, hotelId: r.hotel_id, huespedId: r.huesped_id,
  habitacionId: r.habitacion_id, entrada: r.fecha_entrada, salida: r.fecha_salida,
  numAdultos: r.num_adultos, numNinos: r.num_ninos, precioNoche: r.precio_noche, total: r.total,
  estado: r.estado, canal: r.canal, motivoCancelacion: r.motivo_cancelacion, creadaEn: r.created_at,
});

export class PostgresReservacionRepository extends ReservacionRepository {
  constructor(pool) { super(); this.pool = pool; }

  async guardar(r) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida,
                                    num_adultos, num_ninos, precio_noche, total, estado, canal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [r.hotelId, r.huespedId, r.habitacionId, r.rango.entradaISO, r.rango.salidaISO,
         r.numAdultos, r.numNinos, r.precioNoche, r.total, r.estado, r.canal]);
      return aEntidad(rows[0]);
    } catch (e) {
      // 23P01 = exclusion_violation → la BD detectó una sobreventa (carrera entre 2 recepcionistas)
      if (e.code === '23P01') throw new HabitacionNoDisponibleError();
      // 23514 = check_violation lanzado por trg_reglas_reservacion (RN-11 / RN-13)
      const regla = e.code === '23514' && /^(RN-\d+):\s*(.*)$/.exec(e.message ?? '');
      if (regla) throw Object.assign(new ReservacionError(regla[2], regla[1]), { status: regla[1] === 'RN-13' ? 409 : 400 });
      throw e;
    }
  }

  async buscarPorId(id) {
    const { rows } = await this.pool.query('SELECT * FROM reservaciones WHERE id = $1', [id]);
    return rows[0] ? aEntidad(rows[0]) : null;
  }

  async actualizarEstado(r) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE reservaciones SET estado = $2, motivo_cancelacion = $3 WHERE id = $1 RETURNING *`,
        [r.id, r.estado, r.motivoCancelacion]);
      return rows[0] ? aEntidad(rows[0]) : null;
    } catch (e) {
      // Al reactivar fechas, la BD podría detectar una sobreventa
      if (e.code === '23P01') throw new HabitacionNoDisponibleError();
      throw e;
    }
  }

  async listarPorHotel(hotelId, { desde, hasta }) {
    const { rows } = await this.pool.query(
      `SELECT * FROM reservaciones WHERE hotel_id = $1
         AND daterange(fecha_entrada, fecha_salida, '[)') && daterange($2::date, $3::date, '[)')
       ORDER BY fecha_entrada`, [hotelId, desde, hasta]);
    return rows.map(aEntidad);
  }

  async habitacionDisponible(habitacionId, rango) {
    const { rows } = await this.pool.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM reservaciones WHERE habitacion_id = $1
           AND estado IN ('pendiente','confirmada','check_in')
           AND daterange(fecha_entrada, fecha_salida, '[)') && daterange($2::date, $3::date, '[)')
       ) AS libre`, [habitacionId, rango.entradaISO, rango.salidaISO]);
    return rows[0].libre;
  }
}
