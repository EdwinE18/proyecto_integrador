// PUERTO: lo que el módulo de tarifas necesita de la base de datos.
export class TarifaRepository {
  /** Tipos de habitación del hotel, cada uno con sus temporadas */
  async listarPorHotel(hotelId) { throw new Error('No implementado'); }
  /** @returns {Promise<string|null>} hotel al que pertenece el tipo */
  async hotelDelTipo(tipoId) { throw new Error('No implementado'); }
  /** @returns {Promise<{ temporada: Temporada, hotelId: string } | null>} */
  async buscarTemporada(id) { throw new Error('No implementado'); }
  async guardarTemporada(temporada) { throw new Error('No implementado'); }
  async eliminarTemporada(id) { throw new Error('No implementado'); }
  async actualizarPrecioBase(tipoId, dinero) { throw new Error('No implementado'); }
}
