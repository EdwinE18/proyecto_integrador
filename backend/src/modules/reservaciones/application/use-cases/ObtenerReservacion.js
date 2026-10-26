import { ReservacionNoEncontradaError } from '../../domain/errors/ReservacionError.js';

export class ObtenerReservacion {
  constructor({ reservacionRepository }) { this.repo = reservacionRepository; }
  async ejecutar(id) {
    const r = await this.repo.buscarPorId(id);
    if (!r) throw new ReservacionNoEncontradaError();
    return r;
  }
}
