// PUERTO DE SALIDA de pagos
export class PagoRepository {
  /** @returns {Promise<import('../entities/CuentaReservacion.js').CuentaReservacion|null>} */
  async obtenerCuenta(reservacionId) { throw new Error('No implementado'); }
  /** Guarda el pago. Debe volver a validar el saldo dentro de una transacción. */
  async guardar(pago) { throw new Error('No implementado'); }
}
