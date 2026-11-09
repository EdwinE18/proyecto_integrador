import { Router } from 'express';
import { permitir } from '../../../usuarios/infrastructure/http/auth.middleware.js';

export const hotelRoutes = ({ listarHoteles, configurarHotel }) => {
  const router = Router();
  router.get('/', async (req, res, next) => {
    // RN-75: cada quien ve solo su hotel (el admin general ve todos)
    try { res.json((await listarHoteles.ejecutar()).filter((h) => req.usuario.puedeVerHotel(h.id))); } catch (e) { next(e); }
  });
  // PATCH /api/hoteles/:hotelId — contacto, horarios y chat de Telegram de recepción (RN-79). El hotel ya se validó (RN-75).
  router.patch('/:hotelId', permitir('hotel:configurar'), async (req, res, next) => {
    try { res.json(await configurarHotel.ejecutar(req.params.hotelId, req.body)); } catch (e) { next(e); }
  });
  return router;
};
