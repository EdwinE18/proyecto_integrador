export class TarifaError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'TarifaError'; this.regla = regla; this.status = status; }
}
