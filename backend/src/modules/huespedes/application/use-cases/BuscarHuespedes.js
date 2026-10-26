import { HuespedError } from '../../domain/errors/HuespedError.js';
export class BuscarHuespedes {
  constructor({ huespedRepository }) { this.repo = huespedRepository; }
  async ejecutar(texto) {
    const q = typeof texto === 'string' ? texto.trim() : '';
    if (q.length < 2) throw new HuespedError('Escribe al menos 2 letras para buscar', null);
    return this.repo.buscar(q, 20);
  }
}
