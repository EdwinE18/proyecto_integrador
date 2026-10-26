// OBJETO DE VALOR: cantidades de dinero en CENTAVOS enteros.
// En JavaScript 0.1 + 0.2 = 0.30000000000000004; con centavos enteros no hay errores de redondeo.
import { PagoError } from '../errors/PagoError.js';

export class Dinero {
  constructor(centavos) {
    if (!Number.isSafeInteger(centavos)) throw new PagoError('Cantidad de dinero inválida', 'RN-50');
    this.centavos = centavos;
    Object.freeze(this);
  }

  /** Acepta 1500, "1500", "1500.5", "1,500.50" */
  static dePesos(valor) {
    const texto = String(valor ?? '').replace(/,/g, '').trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(texto))
      throw new PagoError('El monto debe ser un número con máximo 2 decimales', 'RN-50');
    const [enteros, dec = ''] = texto.replace('-', '').split('.');
    const centavos = Number(enteros) * 100 + Number(dec.padEnd(2, '0'));
    return new Dinero(texto.startsWith('-') ? -centavos : centavos);
  }

  static cero() { return new Dinero(0); }
  sumar(otro) { return new Dinero(this.centavos + otro.centavos); }
  restar(otro) { return new Dinero(this.centavos - otro.centavos); }
  esMayorQue(otro) { return this.centavos > otro.centavos; }
  esPositivo() { return this.centavos > 0; }
  esCero() { return this.centavos === 0; }
  get pesos() { return this.centavos / 100; }
  /** "1500.50" — formato que entiende NUMERIC de PostgreSQL */
  toString() {
    const s = Math.abs(this.centavos).toString().padStart(3, '0');
    return (this.centavos < 0 ? '-' : '') + s.slice(0, -2) + '.' + s.slice(-2);
  }
}
