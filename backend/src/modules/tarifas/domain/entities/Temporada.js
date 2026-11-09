// ENTIDAD: precio especial de un tipo de habitación entre dos fechas (salida exclusiva, igual que las reservaciones).
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';
import { TarifaError } from '../errors/TarifaError.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (s) => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

export class Temporada {
  constructor({ id, tipoId, nombre, fechaInicio, fechaFin, precioNoche }) {
    this.id = id;
    this.tipoId = tipoId;
    this.nombre = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
    if (this.nombre.length < 3 || this.nombre.length > 60)
      throw new TarifaError('La temporada necesita un nombre de 3 a 60 letras (ej. "Semana Santa 2027")', 'RN-62');
    if (!esFecha(fechaInicio) || !esFecha(fechaFin)) throw new TarifaError('Fechas inválidas, usa AAAA-MM-DD', 'RN-62');
    if (fechaFin <= fechaInicio) throw new TarifaError('La fecha final debe ser posterior a la inicial', 'RN-62');
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    this.precioNoche = precioNoche instanceof Dinero ? precioNoche : Temporada.precio(precioNoche);
  }

  /** RN-62: un precio por noche siempre es mayor a cero */
  static precio(valor) {
    let d;
    try { d = Dinero.dePesos(valor); } catch { throw new TarifaError('El precio debe ser un número con máximo 2 decimales', 'RN-62'); }
    if (!d.esPositivo()) throw new TarifaError('El precio por noche debe ser mayor a cero', 'RN-62');
    if (d.centavos > 100_000_00) throw new TarifaError('El precio por noche no puede pasar de $100,000', 'RN-62');
    return d;
  }

  yaEmpezo(hoy) { return this.fechaInicio <= hoy; }
  yaTermino(hoy) { return this.fechaFin <= hoy; }
}
