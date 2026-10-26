import { ReservacionError } from '../errors/ReservacionError.js';

// Rango [entrada, salida): la salida no cuenta como noche (RN-02)
export class RangoFechas {
  constructor(entrada, salida) {
    this.entrada = new Date(entrada);
    this.salida = new Date(salida);
    if (isNaN(this.entrada) || isNaN(this.salida)) throw new ReservacionError('Fechas inválidas', 'RN-04');
    if (this.salida <= this.entrada) throw new ReservacionError('La salida debe ser posterior a la entrada', 'RN-04');
  }
  // Fechas como texto 'YYYY-MM-DD'. Así se mandan a la BD: si se manda un Date,
  // la librería pg lo convierte con la hora local y en México se recorre un día.
  get entradaISO() { return this.entrada.toISOString().slice(0, 10); }
  get salidaISO() { return this.salida.toISOString().slice(0, 10); }
  get noches() { return Math.round((this.salida - this.entrada) / 86_400_000); }
  seEnciman(otro) { return this.entrada < otro.salida && otro.entrada < this.salida; }
  /** @param {string} fechaISO 'YYYY-MM-DD' */
  empiezaAntesDe(fechaISO) { return this.entrada < new Date(fechaISO); }
}
