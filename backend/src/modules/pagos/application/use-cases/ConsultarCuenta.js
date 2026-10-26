import { PagoError } from '../../domain/errors/PagoError.js';

export class ConsultarCuenta {
  constructor({ pagoRepository }) { this.repo = pagoRepository; }
  async ejecutar(reservacionId) {
    const cuenta = await this.repo.obtenerCuenta(reservacionId);
    if (!cuenta) throw new PagoError('La reservación no existe', null, 404);
    return cuenta;
  }
}
