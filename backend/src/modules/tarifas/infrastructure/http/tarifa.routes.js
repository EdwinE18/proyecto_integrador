import { Router } from 'express';
import { permitir } from '../../../usuarios/infrastructure/http/auth.middleware.js';

const aTemporadaJSON = (t) => ({ id: t.id, tipoId: t.tipoId, nombre: t.nombre, fechaInicio: t.fechaInicio, fechaFin: t.fechaFin, precioNoche: t.precioNoche.pesos });

// /api/hoteles/:hotelId/tarifas — solo admin y gerente (RN-72); el hotel ya se validó (RN-75)
export const tarifaRoutes = ({ consultarTarifas, crearTemporada, eliminarTemporada, cambiarPrecioBase }) => {
  const router = Router({ mergeParams: true });
  router.use('/tarifas', permitir('tarifas:gestionar'));
  router.get('/tarifas', async (req, res, next) => {
    try {
      const tipos = await consultarTarifas.ejecutar(req.params.hotelId);
      res.json(tipos.map((t) => ({ ...t, precioBase: t.precioBase.pesos, temporadas: t.temporadas.map(aTemporadaJSON) })));
    } catch (e) { next(e); }
  });
  router.patch('/tarifas/tipos/:tipoId', async (req, res, next) => {
    try { await cambiarPrecioBase.ejecutar(req.params.hotelId, req.params.tipoId, req.body); res.status(204).end(); } catch (e) { next(e); }
  });
  router.post('/tarifas/temporadas', async (req, res, next) => {
    try { res.status(201).json(aTemporadaJSON(await crearTemporada.ejecutar(req.params.hotelId, req.body))); } catch (e) { next(e); }
  });
  router.delete('/tarifas/temporadas/:id', async (req, res, next) => {
    try { await eliminarTemporada.ejecutar(req.params.hotelId, req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });
  return router;
};
