import { Temporada } from '../../domain/entities/Temporada.js';
import { TarifaError } from '../../domain/errors/TarifaError.js';

/** RN-62: el nuevo precio solo aplica a reservaciones nuevas; las existentes guardan su total (RN-06) */
export class CambiarPrecioBase {
  constructor({ tarifaRepository }) { this.repo = tarifaRepository; }

  async ejecutar(hotelId, tipoId, { precioBase } = {}) {
    if ((await this.repo.hotelDelTipo(tipoId)) !== hotelId)
      throw new TarifaError('Ese tipo de habitación no existe en este hotel', 'RN-75', 404);
    await this.repo.actualizarPrecioBase(tipoId, Temporada.precio(precioBase));
  }
}
