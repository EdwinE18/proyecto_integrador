import { ReservacionNoEncontradaError } from '../../domain/errors/ReservacionError.js';

// RN-10 y RN-12: solo pendiente/confirmada, y con motivo obligatorio
export class CancelarReservacion {
  constructor({ reservacionRepository, eventPublisher }) {
    this.repo = reservacionRepository;
    this.eventos = eventPublisher;
  }

  async ejecutar(id, motivo) {
    const reservacion = await this.repo.buscarPorId(id);
    if (!reservacion) throw new ReservacionNoEncontradaError();

    reservacion.cancelar(motivo);
    const actualizada = await this.repo.actualizarEstado(reservacion);

    // n8n puede avisar al huésped y liberar la fecha en la agenda
    await this.eventos.publicar('reservacion.cancelada', actualizada.id, {
      codigo: actualizada.codigo, hotelId: actualizada.hotelId, motivo: actualizada.motivoCancelacion,
    });
    return actualizada;
  }
}
