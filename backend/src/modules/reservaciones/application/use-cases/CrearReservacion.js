// CASO DE USO: orquesta dominio + puertos. Recibe las dependencias por constructor.
import { Reservacion } from '../../domain/entities/Reservacion.js';
import { HabitacionNoDisponibleError } from '../../domain/errors/ReservacionError.js';

export class CrearReservacion {
  constructor({ reservacionRepository, eventPublisher }) {
    this.repo = reservacionRepository;
    this.eventos = eventPublisher;
  }

  async ejecutar(datos) {
    const reservacion = new Reservacion(datos);
    if (!(await this.repo.habitacionDisponible(reservacion.habitacionId, reservacion.rango)))
      throw new HabitacionNoDisponibleError();

    const guardada = await this.repo.guardar(reservacion);
    await this.eventos.publicar('reservacion.creada', guardada.id, {
      codigo: guardada.codigo, hotelId: guardada.hotelId, total: guardada.total,
    });
    return guardada;
  }
}
