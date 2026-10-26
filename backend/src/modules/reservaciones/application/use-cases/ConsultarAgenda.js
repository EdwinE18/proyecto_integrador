import { RangoFechas } from '../../domain/value-objects/RangoFechas.js';
import { ReservacionError, ReservacionNoEncontradaError } from '../../domain/errors/ReservacionError.js';

const ESTADOS = ['pendiente', 'confirmada', 'check_in', 'check_out', 'cancelada', 'no_show'];

export class ConsultarAgenda {
  constructor({ reservacionConsultas, reloj }) { Object.assign(this, { reservacionConsultas, reloj }); }

  /** Por defecto: hoy y mañana */
  async ejecutar(hotelId, { desde, hasta, estados } = {}) {
    const hoy = this.reloj.hoy();
    const d = desde || hoy;
    const h = hasta || new Date(new Date(d).getTime() + 86_400_000).toISOString().slice(0, 10);
    const rango = new RangoFechas(d, h);                         // valida fechas (RN-04)
    if (rango.noches > 366) throw new ReservacionError('El rango máximo de la agenda es un año', 'RN-04');
    const lista = typeof estados === 'string' && estados ? estados.split(',') : [];
    if (lista.some((e) => !ESTADOS.includes(e))) throw new ReservacionError(`Estados válidos: ${ESTADOS.join(', ')}`);
    return { hoy, desde: rango.entradaISO, hasta: rango.salidaISO,
             reservaciones: await this.reservacionConsultas.agenda(hotelId, { desde: rango.entradaISO, hasta: rango.salidaISO, estados: lista }) };
  }

  async detalle(id) {
    const r = await this.reservacionConsultas.detalle(id);
    if (!r) throw new ReservacionNoEncontradaError();
    return r;
  }
}
