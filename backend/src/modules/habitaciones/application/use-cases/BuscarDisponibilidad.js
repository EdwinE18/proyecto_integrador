// Busca cuartos libres y cotiza cada uno noche por noche (RN-61).
import { RangoFechas } from '../../../reservaciones/domain/value-objects/RangoFechas.js';
import { cotizar } from '../../../reservaciones/domain/services/Tarifador.js';
import { HabitacionError } from '../../domain/errors/HabitacionError.js';

export class BuscarDisponibilidad {
  constructor({ habitacionRepository, tarifaReader, reloj }) {
    Object.assign(this, { habitacionRepository, tarifaReader, reloj });
  }

  async ejecutar(hotelId, { entrada, salida, adultos = 1, ninos = 0 } = {}) {
    if (!entrada || !salida) throw new HabitacionError('Indica las fechas de entrada y salida', 'RN-04');
    const rango = new RangoFechas(entrada, salida);                      // RN-04
    if (rango.empiezaAntesDe(this.reloj.hoy()))
      throw new HabitacionError('No se puede buscar disponibilidad en fechas pasadas', 'RN-14');
    const gente = { adultos: Number(adultos), ninos: Number(ninos) };
    if (!Number.isInteger(gente.adultos) || gente.adultos < 1 || !Number.isInteger(gente.ninos) || gente.ninos < 0)
      throw new HabitacionError('Debe haber al menos un adulto', 'RN-05');

    const libres = await this.habitacionRepository.disponibles(hotelId, rango, gente);

    // Las temporadas se consultan una vez por tipo de habitación, no por cada cuarto
    const porTipo = new Map();
    for (const h of libres)
      if (!porTipo.has(h.tipoId)) porTipo.set(h.tipoId, await this.tarifaReader.temporadas(h.tipoId, rango));

    return {
      entrada: rango.entradaISO, salida: rango.salidaISO, noches: rango.noches, ...gente,
      habitaciones: libres.map((h) => ({
        habitacion: h,
        cotizacion: cotizar({ rango, precioBase: h.precioBase, temporadas: porTipo.get(h.tipoId) }),
      })),
    };
  }
}
