import { HuespedError } from '../../domain/errors/HuespedError.js';
export class ActualizarHuesped {
  constructor({ huespedRepository }) { this.repo = huespedRepository; }
  async ejecutar(id, cambios = {}) {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new HuespedError('El huésped no existe', null, 404);
    return this.repo.actualizar(actual.conCambios(cambios));
  }
}
