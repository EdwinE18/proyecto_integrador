export class ReservacionError extends Error {
  constructor(msg) { super(msg); this.name = 'ReservacionError'; this.status = 400; }
}
export class HabitacionNoDisponibleError extends ReservacionError {
  constructor() { super('La habitación ya está reservada en esas fechas'); this.status = 409; }
}
