import { HabitacionError } from '../../domain/errors/HabitacionError.js';

export class CambiarEstadoHabitacion {
  constructor({ habitacionRepository, reloj, eventPublisher }) {
    Object.assign(this, { habitacionRepository, reloj, eventPublisher });
  }

  async ejecutar(id, { estado, comentario } = {}) {
    const habitacion = await this.habitacionRepository.buscarPorId(id);
    if (!habitacion) throw new HabitacionError('La habitación no existe', null, 404);

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
