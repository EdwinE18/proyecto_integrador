import { TarifaError } from '../../domain/errors/TarifaError.js';

export class EliminarTemporada {
  constructor({ tarifaRepository, reloj }) { Object.assign(this, { repo: tarifaRepository, reloj }); }

  async ejecutar(hotelId, id) {
    const encontrada = await this.repo.buscarTemporada(id);
    if (!encontrada || encontrada.hotelId !== hotelId) throw new TarifaError('La temporada no existe', 'RN-75', 404);
    // RN-63: una temporada que ya empezó se conserva como historial de precios
    if (encontrada.temporada.yaEmpezo(this.reloj.hoy()))
      throw new TarifaError('Esta temporada ya empezó; se conserva como historial', 'RN-63', 409);
    await this.repo.eliminarTemporada(id);
  }
}
