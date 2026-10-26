// PUERTO: tarifas de temporada que se cruzan con un rango de fechas.
export class TarifaReader {
  /** @returns {Promise<{ nombre, inicio: 'YYYY-MM-DD', fin: 'YYYY-MM-DD', precio: Dinero }[]>} */
  async temporadas(tipoHabitacionId, rango) { throw new Error('No implementado'); }
}
