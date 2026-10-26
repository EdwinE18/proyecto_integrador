import { Router } from 'express';
export const hotelRoutes = ({ listarHoteles }) => {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try { res.json(await listarHoteles.ejecutar()); } catch (e) { next(e); }
  });
  return router;
};
