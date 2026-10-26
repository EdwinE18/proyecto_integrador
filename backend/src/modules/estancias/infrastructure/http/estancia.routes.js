// Rutas anidadas: /api/reservaciones/:id/check-in y /check-out
import { Router } from 'express';

const aJSON = ({ reservacion, estancia, habitacion }) => ({
  reservacionId: reservacion.id,
  codigo: reservacion.codigo,
  estadoReservacion: reservacion.estado,
  habitacion: { numero: habitacion.numero, estado: habitacion.estado },
  estancia: {
    id: estancia.id, placasVehiculo: estancia.placasVehiculo, observaciones: estancia.observaciones,
    checkInReal: estancia.checkInReal, checkOutReal: estancia.checkOutReal,
  },
});

export const estanciaRoutes = ({ registrarCheckIn, registrarCheckOut }) => {
  const router = Router({ mergeParams: true });

  // body opcional: { placas, observaciones }
  router.post('/check-in', async (req, res, next) => {
    try { res.status(201).json(aJSON(await registrarCheckIn.ejecutar(req.params.id, req.body))); }
    catch (e) { next(e); }
  });

  router.post('/check-out', async (req, res, next) => {
    try { res.json(aJSON(await registrarCheckOut.ejecutar(req.params.id))); }
    catch (e) { next(e); }
  });

  return router;
};
