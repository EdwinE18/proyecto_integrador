import { AuthError } from '../errors/AuthError.js';
import { ROLES, permisosDe } from '../permisos.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class Usuario {
  constructor({ id, hotelId = null, nombre, apellidos, email, rol, activo = true, ultimoAcceso = null, telegramChatId = null }) {
    this.id = id;
    this.hotelId = hotelId;
    this.nombre = typeof nombre === 'string' ? nombre.trim() : '';
    this.apellidos = typeof apellidos === 'string' ? apellidos.trim() : '';
    this.email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    this.rol = rol;
    this.activo = activo;
    this.ultimoAcceso = ultimoAcceso;
    this.telegramChatId = telegramChatId == null || String(telegramChatId).trim() === '' ? null : String(telegramChatId).trim();
    // RN-86: el chat de Telegram (para el asistente) es un número que da el propio bot con /miid
    if (this.telegramChatId !== null && !/^-?\d{5,20}$/.test(this.telegramChatId))
      throw new AuthError('El chat de Telegram debe ser un número (el bot te lo da con /miid)', 'RN-86', 400);
    if (!this.nombre || !this.apellidos) throw new AuthError('Nombre y apellidos son obligatorios', 'RN-75', 400);
    if (!EMAIL.test(this.email)) throw new AuthError('Correo inválido', 'RN-75', 400);
    if (!ROLES.includes(rol)) throw new AuthError(`Rol inválido. Usa: ${ROLES.join(', ')}`, 'RN-72', 400);
    // RN-75: solo el administrador general puede no tener hotel
    if (rol !== 'admin' && !hotelId) throw new AuthError('Todo usuario que no es admin debe pertenecer a un hotel', 'RN-75', 400);
  }

  get permisos() { return permisosDe(this.rol); }
  get esAdminGeneral() { return this.rol === 'admin' && !this.hotelId; }

  /** RN-75: ¿puede trabajar con este hotel? */
  puedeVerHotel(hotelId) { return this.esAdminGeneral || this.hotelId === hotelId; }

  /** RN-73: contraseña de al menos 8 caracteres, con letras y números */
  static validarPassword(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 72
        || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password))
      throw new AuthError('La contraseña debe tener de 8 a 72 caracteres, con letras y números', 'RN-73', 400);
  }
}
