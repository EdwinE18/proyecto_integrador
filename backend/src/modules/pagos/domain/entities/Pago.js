// ENTIDAD Pago: un anticipo o pago de una reservación.
import { Dinero } from '../value-objects/Dinero.js';
import { PagoError } from '../errors/PagoError.js';

export const METODOS = ['efectivo', 'tarjeta', 'transferencia', 'deposito'];

export class Pago {
  constructor({ id, reservacionId, monto, metodo, referencia = null, esAnticipo = false, fechaPago = null }) {
    this.id = id;
    this.reservacionId = reservacionId;
    this.monto = monto instanceof Dinero ? monto : Dinero.dePesos(monto);
    if (!this.monto.esPositivo()) throw new PagoError('El monto del pago debe ser mayor a cero', 'RN-50');
    if (!METODOS.includes(metodo))
      throw new PagoError(`Método de pago inválido. Usa: ${METODOS.join(', ')}`, 'RN-50');
    this.metodo = metodo;
    // Referencia limpia: sin espacios de más y en mayúsculas (ej. folio de transferencia)
    const ref = typeof referencia === 'string' ? referencia.trim().replace(/\s+/g, ' ').toUpperCase() : '';
    this.referencia = ref || null;
    if (['transferencia', 'deposito'].includes(metodo) && !this.referencia)
      throw new PagoError('Las transferencias y depósitos necesitan número de referencia', 'RN-56');
    this.esAnticipo = Boolean(esAnticipo);
    this.fechaPago = fechaPago;
  }
}
