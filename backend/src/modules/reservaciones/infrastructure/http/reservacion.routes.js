// ADAPTADOR DE ENTRADA: traduce HTTP ⇄ caso de uso.
import { Router } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cómo se ve una reservación hacia afuera (el frontend y n8n reciben esto)
export const aRespuesta = (r) => ({
  id: r.id,
  codigo: r.codigo,
  hotelId: r.hotelId,
  huespedId: r.huespedId,
  habitacionId: r.habitacionId,
  entrada: r.rango.entradaISO,
  salida: r.rango.salidaISO,
  noches: r.rango.noches,
  numAdultos: r.numAdultos,
  numNinos: r.numNinos,
  precioNoche: r.precioNoche,
  total: r.total,
  estado: r.estado,
  canal: r.canal,
  motivoCancelacion: r.motivoCancelacion,
  ...(r.cotizacion && {
    desglose: r.cotizacion.noches.map((n) => ({ fecha: n.fecha, precio: n.precio.pesos, temporada: n.temporada })),
  }),
});

export const reservacionRoutes = ({
  crearReservacion, listarReservaciones, obtenerReservacion, confirmarReservacion, cancelarReservacion,
}) => {
  const router = Router();

  // Un id que no es UUID se responde 404 sin llegar a la base de datos
  router.param('id', (req, res, next, id) =>
    UUID.test(id) ? next() : res.status(404).json({ error: 'La reservación no existe' }));

  router.post('/', async (req, res, next) => {
    try { res.status(201).json(aRespuesta(await crearReservacion.ejecutar(req.body))); }
    catch (e) { next(e); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { hotelId, desde, hasta } = req.query;
      res.json((await listarReservaciones.ejecutar(hotelId, { desde, hasta })).map(aRespuesta));
    } catch (e) { next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try { res.json(aRespuesta(await obtenerReservacion.ejecutar(req.params.id))); }
    catch (e) { next(e); }
  });

  // RN-09
  router.patch('/:id/confirmar', async (req, res, next) => {
    try { res.json(aRespuesta(await confirmarReservacion.ejecutar(req.params.id))); }
    catch (e) { next(e); }
  });

  // RN-10 y RN-12   body: { "motivo": "..." }
  router.patch('/:id/cancelar', async (req, res, next) => {
    try { res.json(aRespuesta(await cancelarReservacion.ejecutar(req.params.id, req.body?.motivo))); }
    catch (e) { next(e); }
  });

  return router;
};
