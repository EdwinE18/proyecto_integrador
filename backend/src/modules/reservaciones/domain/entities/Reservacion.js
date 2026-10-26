// DOMINIO: reglas de negocio puras. No conoce Express, PostgreSQL ni Telegram.
import { RangoFechas } from '../value-objects/RangoFechas.js';
import {
  ReservacionError, CapacidadExcedidaError, HabitacionNoReservableError,
  HabitacionDeOtroHotelError, FechaPasadaError,
} from '../errors/ReservacionError.js';

const ESTADOS_NO_RESERVABLES = ['mantenimiento', 'fuera_servicio'];
const ESTADOS_CANCELABLES = ['pendiente', 'confirmada'];
const MIN_LARGO_MOTIVO = 5;

export class Reservacion {
  constructor({ id, codigo, hotelId, huespedId, habitacionId, entrada, salida,
                numAdultos = 1, numNinos = 0, precioNoche, estado = 'pendiente', canal = 'mostrador',
                motivoCancelacion = null, creadaEn = null }) {
    this.id = id;
    this.codigo = codigo;
    this.hotelId = hotelId;
    this.huespedId = huespedId;
    this.habitacionId = habitacionId;
    this.rango = new RangoFechas(entrada, salida);
    this.numAdultos = Number(numAdultos);
    this.numNinos = Number(numNinos);
    this.precioNoche = Number(precioNoche);
    this.estado = estado;
    this.canal = canal;
    this.motivoCancelacion = motivoCancelacion;
    this.creadaEn = creadaEn;
    if (!Number.isInteger(this.numAdultos) || this.numAdultos < 1)
      throw new ReservacionError('Debe haber al menos un adulto', 'RN-05');
    if (!Number.isInteger(this.numNinos) || this.numNinos < 0)
      throw new ReservacionError('El número de niños no puede ser negativo', 'RN-05');
  }

  get total() { return this.rango.noches * this.precioNoche; }

  /** RN-14: la entrada no puede ser antes de hoy. @param {string} hoy 'YYYY-MM-DD' */
  validarFechaNoPasada(hoy) {
    if (this.rango.empiezaAntesDe(hoy)) throw new FechaPasadaError();
  }

  /**
   * RN-08, RN-11 y RN-13: la habitación debe ser del hotel, estar en servicio
   * y tener capacidad para los huéspedes.
   */
  validarHabitacion(hab) {
    if (hab.hotelId !== this.hotelId) throw new HabitacionDeOtroHotelError();
    if (!hab.activo) throw new HabitacionNoReservableError(hab.numero, 'fuera_servicio');
    if (ESTADOS_NO_RESERVABLES.includes(hab.estado)) throw new HabitacionNoReservableError(hab.numero, hab.estado);
    if (this.numAdultos > hab.capacidadAdultos || this.numNinos > hab.capacidadNinos)
      throw new CapacidadExcedidaError(hab.numero, hab.capacidadAdultos, hab.capacidadNinos);
  }

  /** RN-09: solo una reservación pendiente se puede confirmar */
  confirmar() {
    if (this.estado !== 'pendiente')
      throw new ReservacionError(`Solo se confirman reservaciones pendientes (esta está ${this.estado})`, 'RN-09');
    this.estado = 'confirmada';
  }

  /**
   * RN-10: solo se cancela lo que todavía no empieza (pendiente o confirmada).
   * RN-12: toda cancelación debe llevar un motivo.
   */
  cancelar(motivo) {
    if (!ESTADOS_CANCELABLES.includes(this.estado))
      throw new ReservacionError(`No se puede cancelar una reservación en estado ${this.estado}`, 'RN-10');
    const limpio = typeof motivo === 'string' ? motivo.trim().replace(/\s+/g, ' ') : '';
    if (limpio.length < MIN_LARGO_MOTIVO)
      throw new ReservacionError(`El motivo de cancelación es obligatorio (mínimo ${MIN_LARGO_MOTIVO} caracteres)`, 'RN-12');
    this.estado = 'cancelada';
    this.motivoCancelacion = limpio;
  }
}
