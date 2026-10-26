export class HuespedError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'HuespedError'; this.regla = regla; this.status = status; }
}
