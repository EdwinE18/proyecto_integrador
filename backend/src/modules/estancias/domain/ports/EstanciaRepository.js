// PUERTO DE SALIDA de estancias.
// Cada operación cambia 3 tablas (reservaciones, habitaciones, estancias):
// el adaptador debe hacerlo en UNA transacción (todo o nada).
export class EstanciaRepository {
  async registrarCheckIn({ reservacion, estancia }) { throw new Error('No implementado'); }
  async registrarCheckOut({ reservacion }) { throw new Error('No implementado'); }
}
