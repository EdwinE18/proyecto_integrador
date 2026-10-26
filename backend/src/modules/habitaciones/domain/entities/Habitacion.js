// ENTIDAD Habitación con su "máquina de estados" (RN-24).
import { HabitacionError } from '../errors/HabitacionError.js';

export const ESTADOS = ['disponible', 'ocupada', 'limpieza', 'mantenimiento', 'fuera_servicio'];

// Cambios que recepción, limpieza o mantenimiento pueden hacer A MANO.
// "ocupada" solo entra y sale con check-in / check-out (módulo de estancias).
const CAMBIOS_MANUALES = {
  disponible:     ['limpieza', 'mantenimiento', 'fuera_servicio'],
  limpieza:       ['disponible', 'mantenimiento'],
  mantenimiento:  ['disponible', 'limpieza', 'fuera_servicio'],
  fuera_servicio: ['disponible', 'mantenimiento'],
  ocupada:        [],
};

export class Habitacion {
  constructor({ id, hotelId, numero, piso = null, estado, activo = true, tipoId, tipo, capacidadAdultos,
                capacidadNinos, precioBase, amenidades = [] }) {
    Object.assign(this, { id, hotelId, numero, piso, estado, activo, tipoId, tipo, capacidadAdultos,
                          capacidadNinos, precioBase, amenidades });
  }

  /** RN-24 */
  cambiarEstado(nuevo) {
    if (!ESTADOS.includes(nuevo))
      throw new HabitacionError(`Estado inválido. Usa: ${ESTADOS.join(', ')}`, 'RN-24');
    if (nuevo === this.estado)
      throw new HabitacionError(`La habitación ${this.numero} ya está en ${nuevo}`, 'RN-24');
    if (nuevo === 'ocupada')
      throw new HabitacionError('Una habitación solo se ocupa haciendo check-in', 'RN-24', 409);
    if (this.estado === 'ocupada')
      throw new HabitacionError(`La habitación ${this.numero} tiene un huésped: primero haz el check-out`, 'RN-24', 409);
    if (!CAMBIOS_MANUALES[this.estado].includes(nuevo))
      throw new HabitacionError(`No se puede pasar de ${this.estado} a ${nuevo}`, 'RN-24', 409);
    this.estadoAnterior = this.estado;
    this.estado = nuevo;
  }
}
