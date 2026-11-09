// ADAPTADOR DE SALIDA: implementa el puerto usando PostgreSQL.
import { ReservacionRepository } from '../../domain/ports/ReservacionRepository.js';
import { Reservacion } from '../../domain/entities/Reservacion.js';
import { HabitacionNoDisponibleError } from '../../domain/errors/ReservacionError.js';

const aEntidad = (r) => new Reservacion({
  id: r.id, codigo: r.codigo, hotelId: r.hotel_id, huespedId: r.huesped_id,
  habitacionId: r.habitacion_id, entrada: r.fecha_entrada, salida: r.fecha_salida,
  numAdultos: r.num_adultos, numNinos: r.num_ninos, precioNoche: r.precio_noche,
  estado: r.estado, canal: r.canal,
});

export class PostgresReservacionRepository extends ReservacionRepository {
  constructor(pool) { super(); this.pool = pool; }

  async guardar(r) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO reservaciones (hotel_id, huesped_id, habitacion_id, fecha_entrada, fecha_salida,
                                    num_adultos, num_ninos, precio_noche, total, estado, canal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [r.hotelId, r.huespedId, r.habitacionId, r.rango.entrada, r.rango.salida,
         r.numAdultos, r.numNinos, r.precioNoche, r.total, r.estado, r.canal]);
      return aEntidad(rows[0]);
    } catch (e) {
      // 23P01 = exclusion_violation → la BD detectó una sobreventa (carrera entre 2 recepcionistas)
      if (e.code === '23P01') throw new HabitacionNoDisponibleError();
      throw e;
    }
  }

  async buscarPorId(id) {
    const { rows } = await this.pool.query('SELECT * FROM reservaciones WHERE id = $1', [id]);
    return rows[0] ? aEntidad(rows[0]) : null;
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
       ) AS libre`, [habitacionId, rango.entrada, rango.salida]);
    return rows[0].libre;
  }
}
