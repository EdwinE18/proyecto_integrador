export class HabitacionError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'HabitacionError'; this.regla = regla; this.status = status; }
}
