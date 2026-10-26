import { Pago } from '../../domain/entities/Pago.js';
import { PagoError } from '../../domain/errors/PagoError.js';

export class RegistrarPago {
  constructor({ pagoRepository, eventPublisher }) { this.repo = pagoRepository; this.eventos = eventPublisher; }

  async ejecutar(reservacionId, datos = {}) {
    const cuenta = await this.repo.obtenerCuenta(reservacionId);
    if (!cuenta) throw new PagoError('La reservación no existe', null, 404);

    const pago = new Pago({ ...datos, reservacionId });   // RN-50, RN-56
    cuenta.validarPago(pago);                              // RN-54, RN-55
    const guardado = await this.repo.guardar(pago);        // la BD lo vuelve a revisar
    cuenta.agregar(guardado);

    await this.eventos.publicar('pago.registrado', reservacionId, {
      codigo: cuenta.codigo, monto: guardado.monto.toString(), saldo: cuenta.saldo.toString(),
    });
    return { pago: guardado, cuenta };
  }
}
