// RN-45: solo se entrega una habitación lista (estado "disponible").
import { EstanciaError } from './errors/EstanciaError.js';

const MENSAJES = {
  limpieza: 'todavía está en limpieza',
  ocupada: 'sigue ocupada (falta el check-out del huésped anterior)',
  mantenimiento: 'está en mantenimiento',
  fuera_servicio: 'está fuera de servicio',
};

export function validarHabitacionLista(habitacion) {
  if (!habitacion.activo || habitacion.estado !== 'disponible')
    throw new EstanciaError(
      `No se puede entregar la habitación ${habitacion.numero}: ${MENSAJES[habitacion.estado] ?? 'está dada de baja'}`,
      'RN-45', 409);
}
