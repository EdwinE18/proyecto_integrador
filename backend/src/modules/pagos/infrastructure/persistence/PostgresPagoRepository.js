import { PagoRepository } from '../../domain/ports/PagoRepository.js';
import { CuentaReservacion } from '../../domain/entities/CuentaReservacion.js';
import { Pago } from '../../domain/entities/Pago.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import { PagoError } from '../../domain/errors/PagoError.js';

const aPago = (f) => new Pago({
  id: f.id, reservacionId: f.reservacion_id, monto: Dinero.dePesos(f.monto), metodo: f.metodo,
  referencia: f.referencia, esAnticipo: f.es_anticipo, fechaPago: f.fecha_pago,
});

export class PostgresPagoRepository extends PagoRepository {
  constructor(pool) { super(); this.pool = pool; }

  async obtenerCuenta(reservacionId) {
    const { rows: [r] } = await this.pool.query(
      'SELECT id, codigo, estado, total FROM reservaciones WHERE id = $1', [reservacionId]);
    if (!r) return null;
    const { rows } = await this.pool.query(
      'SELECT * FROM pagos WHERE reservacion_id = $1 ORDER BY fecha_pago', [reservacionId]);
    return new CuentaReservacion({
      reservacionId: r.id, codigo: r.codigo, estado: r.estado,
      total: Dinero.dePesos(r.total), pagos: rows.map(aPago),
    });
  }

  async guardar(pago) {
    try {
      const { rows: [f] } = await this.pool.query(
        `INSERT INTO pagos (reservacion_id, monto, metodo, referencia, es_anticipo)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [pago.reservacionId, pago.monto.toString(), pago.metodo, pago.referencia, pago.esAnticipo]);
      return aPago(f);
    } catch (e) {
      // El trigger trg_reglas_pago (06_reglas_estancias_pagos.sql) lanza 'RN-54: ...' o 'RN-55: ...'
      const regla = e.code === '23514' && /^(RN-\d+):\s*(.*)$/.exec(e.message ?? '');
      if (regla) throw new PagoError(regla[2], regla[1], regla[1] === 'RN-55' ? 409 : 400);
      throw e;
    }
  }
}
