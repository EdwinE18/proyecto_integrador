// PUERTO DE SALIDA: el dominio define QUÉ necesita; la infraestructura decide CÓMO.
export class ReservacionRepository {
  async guardar(reservacion) { throw new Error('No implementado'); }
  async buscarPorId(id) { throw new Error('No implementado'); }
  async listarPorHotel(hotelId, { desde, hasta }) { throw new Error('No implementado'); }
  async habitacionDisponible(habitacionId, rango) { throw new Error('No implementado'); }
}
