// ADAPTADOR DE ENTRADA: traduce HTTP ⇄ caso de uso.
import { Router } from 'express';

export const reservacionRoutes = ({ crearReservacion, listarReservaciones }) => {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const r = await crearReservacion.ejecutar(req.body);
      res.status(201).json({ id: r.id, codigo: r.codigo, total: r.total, estado: r.estado });
    } catch (e) { next(e); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { hotelId, desde, hasta } = req.query;
      res.json(await listarReservaciones.ejecutar(hotelId, { desde, hasta }));
    } catch (e) { next(e); }
  });

  return router;
};
