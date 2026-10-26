// ADAPTADOR: check-in y check-out en una sola transacción.
import { EstanciaRepository } from '../../domain/ports/EstanciaRepository.js';
import { Estancia } from '../../domain/entities/Estancia.js';
import { EstanciaError } from '../../domain/errors/EstanciaError.js';

const aEstancia = (f) => new Estancia({
  id: f.id, reservacionId: f.reservacion_id, placasVehiculo: f.placas_vehiculo,
  observaciones: f.observaciones, checkInReal: f.check_in_real, checkOutReal: f.check_out_real,
});

export class PostgresEstanciaRepository extends EstanciaRepository {
  constructor(pool) { super(); this.pool = pool; }

  async #enTransaccion(trabajo) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await trabajo(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (e) {
      await cliente.query('ROLLBACK');
      const regla = e.code === '23514' && /^(RN-\d+):\s*(.*)$/.exec(e.message ?? '');
      if (regla) throw new EstanciaError(regla[2], regla[1], 409);
      throw e;
    } finally {
      cliente.release();
    }
  }

  registrarCheckIn({ reservacion, estancia }) {
    return this.#enTransaccion(async (db) => {
      // Los WHERE con el estado esperado evitan que dos recepcionistas hagan check-in al mismo tiempo
      const r = await db.query(
        `UPDATE reservaciones SET estado = 'check_in' WHERE id = $1 AND estado = 'confirmada'`, [reservacion.id]);
      if (r.rowCount === 0) throw new EstanciaError('La reservación cambió mientras se hacía el check-in; vuelve a intentarlo', 'RN-42', 409);

      const h = await db.query(
        `UPDATE habitaciones SET estado = 'ocupada' WHERE id = $1 AND estado = 'disponible' AND activo`, [reservacion.habitacionId]);
      if (h.rowCount === 0) throw new EstanciaError('La habitación ya no está disponible', 'RN-45', 409);

      const { rows: [f] } = await db.query(
        `INSERT INTO estancias (reservacion_id, placas_vehiculo, observaciones) VALUES ($1, $2, $3) RETURNING *`,
        [reservacion.id, estancia.placasVehiculo, estancia.observaciones]);
      return aEstancia(f);
    });
  }

  registrarCheckOut({ reservacion }) {
    return this.#enTransaccion(async (db) => {
      const r = await db.query(
        `UPDATE reservaciones SET estado = 'check_out' WHERE id = $1 AND estado = 'check_in'`, [reservacion.id]);
      if (r.rowCount === 0) throw new EstanciaError('La reservación cambió mientras se hacía el check-out; vuelve a intentarlo', 'RN-43', 409);

      const { rows: [f] } = await db.query(
        `UPDATE estancias SET check_out_real = now() WHERE reservacion_id = $1 AND check_out_real IS NULL RETURNING *`,
        [reservacion.id]);
      if (!f) throw new EstanciaError('No hay una estancia abierta para esta reservación', 'RN-43', 409);

      await db.query(`UPDATE habitaciones SET estado = 'limpieza' WHERE id = $1`, [reservacion.habitacionId]);
      return aEstancia(f);
    });
  }
}
