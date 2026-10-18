import { Router } from 'express';

export const exploradorRoutes = ({ listarTablas, verTabla }) => {
  const router = Router();
  router.get('/tablas', async (_req, res, next) => {
    try { res.json(await listarTablas.ejecutar()); } catch (e) { next(e); }
  });
  router.get('/tablas/:nombre', async (req, res, next) => {
    try { res.json(await verTabla.ejecutar(req.params.nombre, req.query)); } catch (e) { next(e); }
  });
  return router;
};
