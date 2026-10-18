// PUERTO: lo que la aplicación necesita saber de la base de datos.
export class EsquemaRepository {
  async listarTablas() { throw new Error('No implementado'); }
  async describirTabla(nombre) { throw new Error('No implementado'); }
  async obtenerFilas(nombre, { limite, desplazamiento }) { throw new Error('No implementado'); }
}
