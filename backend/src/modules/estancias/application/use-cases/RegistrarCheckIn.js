import { Estancia } from '../../domain/entities/Estancia.js';
import { EstanciaError } from '../../domain/errors/EstanciaError.js';
import { validarHabitacionLista } from '../../domain/reglasHabitacion.js';

export class RegistrarCheckIn {
  constructor({ reservacionRepository, habitacionReader, estanciaRepository, reloj, eventPublisher }) {
    Object.assign(this, { reservacionRepository, habitacionReader, estanciaRepository, reloj, eventPublisher });
  }

  async ejecutar(reservacionId, { placas, observaciones } = {}) {
    const reservacion = await this.reservacionRepository.buscarPorId(reservacionId);
    if (!reservacion) throw new EstanciaError('La reservación no existe', null, 404);

    const habitacion = await this.habitacionReader.obtenerParaReservar(reservacion.habitacionId);
    const estancia = new Estancia({ reservacionId, placasVehiculo: placas, observaciones }); // RN-46

    reservacion.registrarCheckIn(this.reloj.hoy());   // RN-42, RN-44
    validarHabitacionLista(habitacion);                // RN-45

    const guardada = await this.estanciaRepository.registrarCheckIn({ reservacion, estancia });

    await this.eventPublisher.publicar('estancia.check_in', reservacion.id, {
      codigo: reservacion.codigo, habitacion: habitacion.numero,
    });
    return { reservacion, estancia: guardada, habitacion: { ...habitacion, estado: 'ocupada' } };
  }
}
