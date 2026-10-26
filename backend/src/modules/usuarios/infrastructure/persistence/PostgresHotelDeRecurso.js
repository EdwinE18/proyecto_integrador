// RN-75: averigua a qué hotel pertenece un recurso, para revisar que el usuario sea de ese hotel.
export class PostgresHotelDeRecurso {
  constructor(pool) { this.pool = pool; }
  async #uno(sql, id) { const { rows: [f] } = await this.pool.query(sql, [id]); return f?.hotel_id ?? null; }
  deReservacion(id) { return this.#uno('SELECT hotel_id FROM reservaciones WHERE id = $1', id); }
  deHabitacion(id) { return this.#uno('SELECT hotel_id FROM habitaciones WHERE id = $1', id); }
}
