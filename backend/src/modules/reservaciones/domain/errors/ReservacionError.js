// Errores del dominio. Cada uno indica qué regla de negocio se rompió (ver docs/REGLAS_DE_NEGOCIO.md)
export class ReservacionError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'ReservacionError'; this.status = status; this.regla = regla; }
}
// RN-01
export class HabitacionNoDisponibleError extends ReservacionError {
  constructor() { super('La habitación ya está reservada en esas fechas', 'RN-01'); this.status = 409; }
}
export class ReservacionNoEncontradaError extends ReservacionError {
  constructor() { super('La reservación no existe'); this.status = 404; }
}
export class HabitacionNoEncontradaError extends ReservacionError {
  constructor() { super('La habitación no existe', 'RN-08'); this.status = 404; }
}
// RN-08
export class HabitacionDeOtroHotelError extends ReservacionError {
  constructor() { super('La habitación no pertenece a este hotel', 'RN-08'); }
}
// RN-11
export class CapacidadExcedidaError extends ReservacionError {
  constructor(numero, adultos, ninos) {
    super(`La habitación ${numero} admite máximo ${adultos} adulto(s) y ${ninos} niño(s)`, 'RN-11');
  }
}
// RN-13
export class HabitacionNoReservableError extends ReservacionError {
  constructor(numero, estado) {
    super(`La habitación ${numero} no se puede reservar: está en ${estado.replace('_', ' ')}`, 'RN-13');
    this.status = 409;
  }
}
// RN-14
export class FechaPasadaError extends ReservacionError {
  constructor() { super('No se pueden crear reservaciones con fecha de entrada en el pasado', 'RN-14'); }
}
