import { HuespedError } from '../../domain/errors/HuespedError.js';
export class ObtenerHuesped {
  constructor({ huespedRepository }) { this.repo = huespedRepository; }
  async ejecutar(id) {
    const h = await this.repo.buscarPorId(id);
    if (!h) throw new HuespedError('El huésped no existe', null, 404);
    return h;
  }
}
