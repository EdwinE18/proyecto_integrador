import { ConfiguracionHotel } from '../../domain/entities/ConfiguracionHotel.js';
import { HotelError } from '../../domain/errors/HotelError.js';

export class ConfigurarHotel {
  constructor({ hotelRepository }) { this.repo = hotelRepository; }
  async ejecutar(hotelId, datos = {}) {
    if (!(await this.repo.existe(hotelId))) throw new HotelError('El hotel no existe', 'RN-75', 404);
    const config = new ConfiguracionHotel(datos);   // RN-79
    await this.repo.actualizarConfiguracion(hotelId, config);
    return config;
  }
}
