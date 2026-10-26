// CASO DE USO: orquesta dominio + puertos. Recibe las dependencias por constructor.
import { Reservacion } from '../../domain/entities/Reservacion.js';
import { HabitacionNoDisponibleError, HabitacionNoEncontradaError } from '../../domain/errors/ReservacionError.js';
import { cotizar } from '../../domain/services/Tarifador.js';

export class CrearReservacion {
  constructor({ reservacionRepository, habitacionReader, tarifaReader, reloj, eventPublisher }) {
    this.repo = reservacionRepository;
    this.habitaciones = habitacionReader;
    this.tarifas = tarifaReader;
    this.reloj = reloj;
    this.eventos = eventPublisher;
  }

  async ejecutar(datos) {
    // RN-61: se ignora cualquier precio que mande el cliente
    const { precioNoche, total, ...resto } = datos;
    // RN-04, RN-05: fechas válidas, al menos un adulto
    const reservacion = new Reservacion(resto);

    // RN-14: no fechas pasadas
    reservacion.validarFechaNoPasada(this.reloj.hoy());

    // RN-08, RN-11, RN-13: la habitación existe, es del hotel, está en servicio y cabe la gente
    const habitacion = await this.habitaciones.obtenerParaReservar(reservacion.habitacionId);
    if (!habitacion) throw new HabitacionNoEncontradaError();
    reservacion.validarHabitacion(habitacion);

    // RN-61 y RN-06: precio noche por noche (base o temporada)
    const temporadas = await this.tarifas.temporadas(habitacion.tipoId, reservacion.rango);
    const cotizacion = cotizar({ rango: reservacion.rango, precioBase: habitacion.precioBase, temporadas });
    reservacion.aplicarCotizacion(cotizacion);

    // RN-01: no sobreventa (la BD lo vuelve a revisar al guardar)
    if (!(await this.repo.habitacionDisponible(reservacion.habitacionId, reservacion.rango)))
      throw new HabitacionNoDisponibleError();

    const guardada = await this.repo.guardar(reservacion);

    // RN-80: evento para n8n / Node-RED
    await this.eventos.publicar('reservacion.creada', guardada.id, {
      codigo: guardada.codigo, hotelId: guardada.hotelId, total: guardada.total,
    });
    guardada.cotizacion = cotizacion;   // para mostrar el desglose en la respuesta
    return guardada;
  }
}
