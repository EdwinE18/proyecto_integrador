export class EstanciaError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'EstanciaError'; this.regla = regla; this.status = status; }
}
