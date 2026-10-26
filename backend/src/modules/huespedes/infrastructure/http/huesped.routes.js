import { Router } from 'express';
import { validarUUID } from '../../../../shared/infrastructure/http/middlewares/validarUUID.js';

export const aHuespedJSON = (h) => ({
  id: h.id, nombre: h.nombre, apellidos: h.apellidos, nombreCompleto: h.nombreCompleto,
  email: h.email, telefono: h.telefono, tipoDocumento: h.tipoDocumento,
  // RN-34: el documento completo no se envía al navegador, solo los últimos 4 caracteres
  documento: h.numDocumento ? `${'*'.repeat(Math.max(h.numDocumento.length - 4, 0))}${h.numDocumento.slice(-4)}` : null,
  nacionalidad: h.nacionalidad, fechaNacimiento: h.fechaNacimiento, ciudadOrigen: h.ciudadOrigen,
  telegramChatId: h.telegramChatId, notas: h.notas,
});

export const huespedRoutes = ({ registrarHuesped, actualizarHuesped, buscarHuespedes, obtenerHuesped }) => {
  const router = Router();
  const conId = validarUUID('id', 'El huésped no existe');

  router.get('/', async (req, res, next) => {
    try { res.json((await buscarHuespedes.ejecutar(req.query.q)).map(aHuespedJSON)); } catch (e) { next(e); }
  });
  router.post('/', async (req, res, next) => {
    try { res.status(201).json(aHuespedJSON(await registrarHuesped.ejecutar(req.body))); } catch (e) { next(e); }
  });
  router.get('/:id', conId, async (req, res, next) => {
    try { res.json(aHuespedJSON(await obtenerHuesped.ejecutar(req.params.id))); } catch (e) { next(e); }
  });
  router.patch('/:id', conId, async (req, res, next) => {
    try { res.json(aHuespedJSON(await actualizarHuesped.ejecutar(req.params.id, req.body))); } catch (e) { next(e); }
  });
  return router;
};
