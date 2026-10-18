import { TablaNoEncontradaError } from '../../domain/errors/TablaNoEncontradaError.js';

export class VerTabla {
  constructor({ esquemaRepository }) { this.repo = esquemaRepository; }

  async ejecutar(nombre, { limite = 50, desplazamiento = 0 } = {}) {
    const tablas = await this.repo.listarTablas();
    if (!tablas.some((t) => t.nombre === nombre)) throw new TablaNoEncontradaError(nombre);
    limite = Math.min(Math.max(Number(limite) || 50, 1), 200);
    desplazamiento = Math.max(Number(desplazamiento) || 0, 0);
    const estructura = await this.repo.describirTabla(nombre);
    const datos = await this.repo.obtenerFilas(nombre, { limite, desplazamiento });
    return { nombre, ...estructura, ...datos, limite, desplazamiento };
  }
}
