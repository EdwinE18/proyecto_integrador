import { ReservacionError } from '../errors/ReservacionError.js';

// Rango [entrada, salida): la salida no cuenta como noche (RN-02)
export class RangoFechas {
  constructor(entrada, salida) {
    this.entrada = new Date(entrada);
    this.salida = new Date(salida);
    if (isNaN(this.entrada) || isNaN(this.salida)) throw new ReservacionError('Fechas inválidas', 'RN-04');
    if (this.salida <= this.entrada) throw new ReservacionError('La salida debe ser posterior a la entrada', 'RN-04');
  }
  get noches() { return Math.round((this.salida - this.entrada) / 86_400_000); }
  seEnciman(otro) { return this.entrada < otro.salida && otro.entrada < this.salida; }
  /** @param {string} fechaISO 'YYYY-MM-DD' */
  empiezaAntesDe(fechaISO) { return this.entrada < new Date(fechaISO); }
}
