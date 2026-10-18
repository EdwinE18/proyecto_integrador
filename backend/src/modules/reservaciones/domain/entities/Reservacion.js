// DOMINIO: reglas de negocio puras. No conoce Express, PostgreSQL ni Telegram.
import { RangoFechas } from '../value-objects/RangoFechas.js';
import { ReservacionError } from '../errors/ReservacionError.js';

export class Reservacion {
  constructor({ id, codigo, hotelId, huespedId, habitacionId, entrada, salida,
                numAdultos = 1, numNinos = 0, precioNoche, estado = 'pendiente', canal = 'mostrador' }) {
    this.id = id;
    this.codigo = codigo;
    this.hotelId = hotelId;
    this.huespedId = huespedId;
    this.habitacionId = habitacionId;
    this.rango = new RangoFechas(entrada, salida);
    this.numAdultos = numAdultos;
    this.numNinos = numNinos;
    this.precioNoche = Number(precioNoche);
    this.estado = estado;
    this.canal = canal;
  }

  get total() { return this.rango.noches * this.precioNoche; }

  confirmar() {
    if (this.estado !== 'pendiente') throw new ReservacionError('Solo se confirman reservaciones pendientes');
    this.estado = 'confirmada';
  }

  cancelar() {
    if (['check_in', 'check_out'].includes(this.estado))
      throw new ReservacionError('No se puede cancelar una estancia en curso o terminada');
    this.estado = 'cancelada';
  }
}
