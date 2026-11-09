import { ReservacionError } from '../errors/ReservacionError.js';

export class RangoFechas {
  constructor(entrada, salida) {
    this.entrada = new Date(entrada);
    this.salida = new Date(salida);
    if (isNaN(this.entrada) || isNaN(this.salida)) throw new ReservacionError('Fechas inválidas');
    if (this.salida <= this.entrada) throw new ReservacionError('La salida debe ser posterior a la entrada');
  }
  get noches() { return Math.round((this.salida - this.entrada) / 86_400_000); }
  seEnciman(otro) { return this.entrada < otro.salida && otro.entrada < this.salida; }
}
