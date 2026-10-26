export class PagoError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'PagoError'; this.regla = regla; this.status = status; }
}
