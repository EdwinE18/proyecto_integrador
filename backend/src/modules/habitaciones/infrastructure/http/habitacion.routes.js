import { Router } from 'express';
import { validarUUID } from '../../../../shared/infrastructure/http/middlewares/validarUUID.js';

export const aHabitacionJSON = (h) => ({
  id: h.id, numero: h.numero, piso: h.piso, estado: h.estado, tipo: h.tipo,
  capacidadAdultos: h.capacidadAdultos, capacidadNinos: h.capacidadNinos,
  precioBase: h.precioBase.pesos, amenidades: h.amenidades,
});

// /api/hoteles/:hotelId/habitaciones  y  /api/hoteles/:hotelId/disponibilidad
export const habitacionesDeHotelRoutes = ({ listarHabitaciones, buscarDisponibilidad }) => {
  const router = Router({ mergeParams: true });
  router.get('/habitaciones', async (req, res, next) => {
    try { res.json((await listarHabitaciones.ejecutar(req.params.hotelId)).map(aHabitacionJSON)); } catch (e) { next(e); }
  });
  // ?entrada=2026-12-20&salida=2026-12-22&adultos=2&ninos=0
  router.get('/disponibilidad', async (req, res, next) => {
    try {
      const r = await buscarDisponibilidad.ejecutar(req.params.hotelId, req.query);
      res.json({
        entrada: r.entrada, salida: r.salida, noches: r.noches, adultos: r.adultos, ninos: r.ninos,
        habitaciones: r.habitaciones.map(({ habitacion, cotizacion }) => ({
          ...aHabitacionJSON(habitacion),
          total: cotizacion.total.pesos,
          promedioNoche: cotizacion.promedioNoche.pesos,
          desglose: cotizacion.noches.map((n) => ({ fecha: n.fecha, precio: n.precio.pesos, temporada: n.temporada })),
        })),
      });
    } catch (e) { next(e); }
  });
  return router;
};

// /api/habitaciones/:id/estado
export const habitacionRoutes = ({ cambiarEstadoHabitacion }) => {
  const router = Router();
  // body: { estado: 'disponible' | 'limpieza' | 'mantenimiento' | 'fuera_servicio', comentario? }
  router.patch('/:id/estado', validarUUID('id', 'La habitación no existe'), async (req, res, next) => {
    try {
      const { habitacion, reservacionesAfectadas } = await cambiarEstadoHabitacion.ejecutar(req.params.id, req.body);
      res.json({ habitacion: aHabitacionJSON(habitacion), reservacionesAfectadas });
    } catch (e) { next(e); }
  });
  return router;
};
