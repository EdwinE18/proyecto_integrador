import { HabitacionError } from '../../domain/errors/HabitacionError.js';
import { puede, permisoParaEstado } from '../../../usuarios/domain/permisos.js';

export class CambiarEstadoHabitacion {
  constructor({ habitacionRepository, reloj, eventPublisher }) {
    Object.assign(this, { habitacionRepository, reloj, eventPublisher });
  }

  /** @param usuario quien hace el cambio (RN-72: limpieza solo puede marcar limpieza ⇄ disponible) */
  async ejecutar(id, { estado, comentario } = {}, usuario = null) {
    const habitacion = await this.habitacionRepository.buscarPorId(id);
    if (!habitacion) throw new HabitacionError('La habitación no existe', null, 404);

    if (usuario && !puede(usuario.rol, permisoParaEstado(habitacion.estado, estado)))
      throw new HabitacionError('Tu rol no puede sacar o regresar habitaciones de servicio', 'RN-72', 403);
    habitacion.cambiarEstado(estado);                                  // RN-24
    const nota = typeof comentario === 'string' && comentario.trim() ? comentario.trim() : null;
    if (['mantenimiento', 'fuera_servicio'].includes(estado) && !nota)
      throw new HabitacionError('Explica en el comentario por qué la habitación sale de servicio', 'RN-25');
    await this.habitacionRepository.guardarEstado(habitacion, nota);

    // Si sale de servicio, avisar qué reservaciones hay que reubicar
    const afectadas = ['mantenimiento', 'fuera_servicio'].includes(estado)
      ? await this.habitacionRepository.reservacionesProximas(id, this.reloj.hoy()) : [];

    await this.eventPublisher.publicar('habitacion.estado_cambiado', id, {
      numero: habitacion.numero, de: habitacion.estadoAnterior, a: estado, reservacionesAfectadas: afectadas.length,
    });
    return { habitacion, reservacionesAfectadas: afectadas };
  }
}
