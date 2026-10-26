import { Router } from 'express';
export const hotelRoutes = ({ listarHoteles }) => {
  const router = Router();
  router.get('/', async (req, res, next) => {
    // RN-75: cada quien ve solo su hotel (el admin general ve todos)
    try { res.json((await listarHoteles.ejecutar()).filter((h) => req.usuario.puedeVerHotel(h.id))); } catch (e) { next(e); }
  });
  return router;
};
