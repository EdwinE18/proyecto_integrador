import { EstanciaError } from '../../domain/errors/EstanciaError.js';

export class RegistrarCheckOut {
  constructor({ reservacionRepository, habitacionReader, pagoRepository, estanciaRepository, eventPublisher }) {
    Object.assign(this, { reservacionRepository, habitacionReader, pagoRepository, estanciaRepository, eventPublisher });
  }

  async ejecutar(reservacionId) {
    const reservacion = await this.reservacionRepository.buscarPorId(reservacionId);
    if (!reservacion) throw new EstanciaError('La reservación no existe', null, 404);

    reservacion.registrarCheckOut();                    // RN-43

    // RN-52: no se va sin pagar
    const cuenta = await this.pagoRepository.obtenerCuenta(reservacionId);
    if (!cuenta.liquidada)
      throw new EstanciaError(`No se puede hacer check-out: falta pagar $${cuenta.saldo}`, 'RN-52', 409);

    const estancia = await this.estanciaRepository.registrarCheckOut({ reservacion });
    const habitacion = await this.habitacionReader.obtenerParaReservar(reservacion.habitacionId);

    // RN-43: n8n usa este evento para avisar a limpieza por Telegram
    await this.eventPublisher.publicar('estancia.check_out', reservacion.id, {
      codigo: reservacion.codigo, habitacion: habitacion.numero, hotelId: reservacion.hotelId,
    });
    return { reservacion, estancia, habitacion };
  }
}
