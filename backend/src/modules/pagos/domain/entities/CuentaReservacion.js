// ENTIDAD CuentaReservacion: el estado de cuenta de una reservación (total, pagos y saldo).
import { Dinero } from '../value-objects/Dinero.js';
import { PagoError } from '../errors/PagoError.js';

const ESTADOS_QUE_ACEPTAN_PAGOS = ['pendiente', 'confirmada', 'check_in'];

export class CuentaReservacion {
  /** @param {{ reservacionId, codigo, estado, total: Dinero, pagos: import('./Pago.js').Pago[] }} datos */
  constructor({ reservacionId, codigo, estado, total, pagos = [] }) {
    this.reservacionId = reservacionId;
    this.codigo = codigo;
    this.estado = estado;
    this.total = total;
    this.pagos = pagos;
  }

  get pagado() { return this.pagos.reduce((suma, p) => suma.sumar(p.monto), Dinero.cero()); }
  get saldo() { return this.total.restar(this.pagado); }        // RN-51
  get liquidada() { return !this.saldo.esPositivo(); }

  /** RN-54 y RN-55: revisa que el pago se pueda aplicar a esta cuenta */
  validarPago(pago) {
    if (!ESTADOS_QUE_ACEPTAN_PAGOS.includes(this.estado))
      throw new PagoError(`No se pueden registrar pagos en una reservación ${this.estado}`, 'RN-55', 409);
    if (pago.monto.esMayorQue(this.saldo))
      throw new PagoError(`El pago ($${pago.monto}) es mayor que el saldo pendiente ($${this.saldo})`, 'RN-54');
  }

  /** Agrega un pago ya guardado (con id y fecha) */
  agregar(pago) { this.pagos.push(pago); }
}
