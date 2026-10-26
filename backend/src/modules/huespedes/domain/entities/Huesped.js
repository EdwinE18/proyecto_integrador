// ENTIDAD Huésped. Limpia y valida los datos antes de guardarlos.
// (La BD también los normaliza con el trigger trg_normalizar_huesped.)
import { HuespedError } from '../errors/HuespedError.js';

export const TIPOS_DOCUMENTO = ['INE', 'pasaporte', 'licencia', 'otro'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
// "maRÍA  josé" → "María José"
const nombrePropio = (v) => texto(v)?.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()) ?? null;

export class Huesped {
  constructor(datos = {}) {
    const { id, nombre, apellidos, email, telefono, tipoDocumento, numDocumento,
            nacionalidad = 'Mexicana', fechaNacimiento, ciudadOrigen, telegramChatId, notas } = datos;
    this.id = id;
    this.nombre = nombrePropio(nombre);
    this.apellidos = nombrePropio(apellidos);
    if (!this.nombre || !this.apellidos) throw new HuespedError('Nombre y apellidos son obligatorios', 'RN-31');
    if (this.nombre.length > 80 || this.apellidos.length > 120) throw new HuespedError('Nombre o apellidos demasiado largos', 'RN-31');

    // RN-32: al menos un medio de contacto, con formato válido
    this.email = texto(email)?.toLowerCase() ?? null;
    if (this.email && !EMAIL.test(this.email)) throw new HuespedError('El correo no tiene un formato válido', 'RN-32');
    this.telefono = Huesped.normalizarTelefono(telefono);
    if (!this.email && !this.telefono)
      throw new HuespedError('Registra al menos un correo o un teléfono para poder confirmar la reservación', 'RN-32');

    // RN-33: tipo y número de documento van juntos
    this.tipoDocumento = texto(tipoDocumento);
    this.numDocumento = texto(numDocumento)?.toUpperCase().replace(/[\s-]/g, '') ?? null;
    if (Boolean(this.tipoDocumento) !== Boolean(this.numDocumento))
      throw new HuespedError('Si registras documento, indica tipo y número', 'RN-33');
    if (this.tipoDocumento && !TIPOS_DOCUMENTO.includes(this.tipoDocumento))
      throw new HuespedError(`Tipo de documento inválido. Usa: ${TIPOS_DOCUMENTO.join(', ')}`, 'RN-33');

    this.nacionalidad = nombrePropio(nacionalidad);
    this.fechaNacimiento = fechaNacimiento || null;
    this.ciudadOrigen = nombrePropio(ciudadOrigen);
    this.telegramChatId = texto(telegramChatId);
    this.notas = texto(notas);
  }

  get nombreCompleto() { return `${this.nombre} ${this.apellidos}`; }

  /** "(961) 123-45 67" → "9611234567"; "+49 151 234" → "+49151234". 10 a 15 dígitos. */
  static normalizarTelefono(valor) {
    const t = texto(valor);
    if (!t) return null;
    const limpio = (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
    const digitos = limpio.replace('+', '').length;
    if (digitos < 10 || digitos > 15) throw new HuespedError('El teléfono debe tener entre 10 y 15 dígitos', 'RN-32');
    return limpio;
  }

  /** Aplica cambios parciales y vuelve a validar todo */
  conCambios(cambios) {
    return new Huesped({ ...this, ...Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)), id: this.id });
  }
}
