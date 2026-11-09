import { Temporada } from '../../domain/entities/Temporada.js';
import { TarifaError } from '../../domain/errors/TarifaError.js';

export class CrearTemporada {
  constructor({ tarifaRepository, reloj }) { Object.assign(this, { repo: tarifaRepository, reloj }); }

  async ejecutar(hotelId, datos = {}) {
    // RN-75: el tipo de habitación debe ser del hotel con el que se trabaja
    if ((await this.repo.hotelDelTipo(datos.tipoId)) !== hotelId)
      throw new TarifaError('Ese tipo de habitación no existe en este hotel', 'RN-75', 404);
    const t = new Temporada(datos);                                         // RN-62
    if (t.yaTermino(this.reloj.hoy())) throw new TarifaError('No se crean temporadas que ya terminaron', 'RN-63');
    return this.repo.guardarTemporada(t);                                   // RN-60: la BD impide que se enciman
  }
}
