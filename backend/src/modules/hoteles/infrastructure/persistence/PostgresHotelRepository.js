import { HotelRepository } from '../../domain/ports/HotelRepository.js';

export class PostgresHotelRepository extends HotelRepository {
  constructor(pool) { super(); this.pool = pool; }
  async listar() {
    const { rows } = await this.pool.query(
      `SELECT ho.id, ho.nombre, ho.tipo, ho.ciudad, ho.telefono, ho.email, ho.direccion, ho.telegram_chat_id,
              to_char(ho.hora_check_in, 'HH24:MI') AS hora_check_in, to_char(ho.hora_check_out, 'HH24:MI') AS hora_check_out,
              o.total_habitaciones, o.ocupadas, o.porcentaje_ocupacion
       FROM hoteles ho LEFT JOIN v_ocupacion_hoy o ON o.hotel_id = ho.id
       WHERE ho.activo ORDER BY ho.nombre`);
    return rows.map((r) => ({
      id: r.id, nombre: r.nombre, tipo: r.tipo, ciudad: r.ciudad, telefono: r.telefono, email: r.email,
      direccion: r.direccion, telegramChatId: r.telegram_chat_id,
      horaCheckIn: r.hora_check_in, horaCheckOut: r.hora_check_out,
      ocupacionHoy: { habitaciones: Number(r.total_habitaciones ?? 0), ocupadas: Number(r.ocupadas ?? 0),
                      porcentaje: Number(r.porcentaje_ocupacion ?? 0) },
    }));
  }

  async existe(hotelId) {
    const { rowCount } = await this.pool.query('SELECT 1 FROM hoteles WHERE id = $1 AND activo', [hotelId]);
    return rowCount > 0;
  }
  async actualizarConfiguracion(hotelId, c) {
    await this.pool.query(
      `UPDATE hoteles SET telefono = $2, email = $3, direccion = $4, hora_check_in = $5, hora_check_out = $6,
              telegram_chat_id = $7, updated_at = now() WHERE id = $1`,
      [hotelId, c.telefono, c.email, c.direccion, c.horaCheckIn, c.horaCheckOut, c.telegramChatId]);
  }
}
