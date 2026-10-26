export class HabitacionRepository {
  async listarPorHotel(hotelId) { throw new Error('No implementado'); }
  async buscarPorId(id) { throw new Error('No implementado'); }
  /** Guarda el nuevo estado y el comentario en el historial (RN-22). */
  async guardarEstado(habitacion, comentario) { throw new Error('No implementado'); }
  /** Habitaciones libres en esas fechas, en servicio y donde cabe la gente (RN-01, RN-11, RN-13). */
  async disponibles(hotelId, rango, { adultos, ninos }) { throw new Error('No implementado'); }
  /** Reservaciones activas desde hoy, para avisar si un cuarto entra a mantenimiento. */
  async reservacionesProximas(habitacionId, desdeISO) { throw new Error('No implementado'); }
}
