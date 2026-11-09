export class ReporteError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'ReporteError'; this.regla = regla; this.status = status; }
}
