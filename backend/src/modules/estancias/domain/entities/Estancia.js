// ENTIDAD Estancia: lo que realmente pasó (llegada y salida reales), distinto de lo reservado.
import { EstanciaError } from '../errors/EstanciaError.js';

export class Estancia {
  constructor({ id, reservacionId, placasVehiculo = null, observaciones = null,
                checkInReal = null, checkOutReal = null }) {
    this.id = id;
    this.reservacionId = reservacionId;
    this.placasVehiculo = Estancia.normalizarPlacas(placasVehiculo);
    this.observaciones = typeof observaciones === 'string' && observaciones.trim() ? observaciones.trim() : null;
    this.checkInReal = checkInReal;
    this.checkOutReal = checkOutReal;
  }

  /** "abc-12 34" → "ABC1234". Solo letras y números, de 5 a 10 caracteres. */
  static normalizarPlacas(placas) {
    if (placas === null || placas === undefined || String(placas).trim() === '') return null;
    const limpias = String(placas).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpias.length < 5 || limpias.length > 10)
      throw new EstanciaError('Las placas deben tener entre 5 y 10 letras o números', 'RN-46');
    return limpias;
  }
}
