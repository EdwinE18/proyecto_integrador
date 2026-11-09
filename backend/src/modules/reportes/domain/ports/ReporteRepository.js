// PUERTO: datos crudos de un periodo (desde y hasta INCLUSIVOS, 'YYYY-MM-DD').
export class ReporteRepository {
  /**
   * @returns {Promise<{
   *   habitaciones: number,
   *   dias: { fecha: string, ocupadas: number, ingreso: Dinero }[],
   *   cobrado: { metodo: string, monto: Dinero, pagos: number }[],
   *   porCanal: { canal: string, reservaciones: number }[],
   *   porEstado: { estado: string, reservaciones: number }[],
   *   cancelaciones: { motivo: string, veces: number }[],
   *   porCobrar: Dinero,
   * }>}
   */
  async datosDelPeriodo(hotelId, desde, hasta) { throw new Error('No implementado'); }
}
