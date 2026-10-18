export class TablaNoEncontradaError extends Error {
  constructor(nombre) { super(`La tabla "${nombre}" no existe`); this.status = 404; }
}
