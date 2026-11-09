// OBJETO DE VALOR: lo que el administrador o gerente puede ajustar de su hotel (RN-79).
import { HotelError } from '../errors/HotelError.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const limpio = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export class ConfiguracionHotel {
  constructor({ telefono, email, direccion, horaCheckIn, horaCheckOut, telegramChatId }) {
    this.telefono = limpio(telefono)?.replace(/[^\d+]/g, '') ?? null;
    this.email = limpio(email)?.toLowerCase() ?? null;
    this.direccion = limpio(direccion);
    this.horaCheckIn = limpio(horaCheckIn);
    this.horaCheckOut = limpio(horaCheckOut);
    this.telegramChatId = limpio(telegramChatId === null || telegramChatId === undefined ? '' : String(telegramChatId));

    if (this.telefono && !/^\+?\d{10,13}$/.test(this.telefono)) throw new HotelError('Teléfono inválido (10 dígitos, puede llevar lada +52)', 'RN-79');
    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email)) throw new HotelError('Correo inválido', 'RN-79');
    if (!HORA.test(this.horaCheckIn ?? '') || !HORA.test(this.horaCheckOut ?? ''))
      throw new HotelError('Las horas de entrada y salida van en formato HH:MM', 'RN-79');
    // La salida es antes que la entrada para que haya tiempo de limpiar el cuarto el mismo día (RN-02)
    if (this.horaCheckOut >= this.horaCheckIn)
      throw new HotelError('La hora de salida debe ser anterior a la de entrada, para dar tiempo a limpieza', 'RN-79');
    if (this.telegramChatId && !/^-?\d{5,20}$/.test(this.telegramChatId))
      throw new HotelError('El chat de Telegram es un número (los grupos empiezan con -100…)', 'RN-79');
  }
}
