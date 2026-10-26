// PUERTO DE LECTURA (modelo de lectura): datos ya combinados para mostrar en pantallas.
// No pasa por las entidades porque solo se consulta, no se cambia nada.
export class ReservacionConsultas {
  /** Reservaciones que se cruzan con [desde, hasta), con huésped, habitación y saldo */
  async agenda(hotelId, { desde, hasta, estados }) { throw new Error('No implementado'); }
  /** Una reservación con todo su detalle */
  async detalle(id) { throw new Error('No implementado'); }
}
