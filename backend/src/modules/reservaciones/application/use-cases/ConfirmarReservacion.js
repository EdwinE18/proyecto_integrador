import { ReservacionNoEncontradaError } from '../../domain/errors/ReservacionError.js';

// RN-09: pendiente → confirmada
export class ConfirmarReservacion {
  constructor({ reservacionRepository, eventPublisher }) {
    this.repo = reservacionRepository;
    this.eventos = eventPublisher;
  }

  async ejecutar(id) {
    const reservacion = await this.repo.buscarPorId(id);
    if (!reservacion) throw new ReservacionNoEncontradaError();

    reservacion.confirmar();                       // aquí el dominio aplica la regla
    const actualizada = await this.repo.actualizarEstado(reservacion);

    await this.eventos.publicar('reservacion.confirmada', actualizada.id, {
      codigo: actualizada.codigo, hotelId: actualizada.hotelId,
    });
    return actualizada;
  }
}
