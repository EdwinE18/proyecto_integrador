import { Router } from 'express';
import { permitir } from './auth.middleware.js';
import { validarUUID } from '../../../../shared/infrastructure/http/middlewares/validarUUID.js';
import { puedeGestionar } from '../../domain/politicaPersonal.js';

export const aUsuarioJSON = (u) => ({
  id: u.id, hotelId: u.hotelId, nombre: u.nombre, apellidos: u.apellidos, email: u.email,
  rol: u.rol, activo: u.activo, ultimoAcceso: u.ultimoAcceso, permisos: u.permisos, telegramChatId: u.telegramChatId,
});

/** /api/auth — login es público; lo demás necesita sesión (se pasa el middleware `conSesion`) */
export const authRoutes = ({ iniciarSesion, cambiarPassword }, conSesion) => {
  const router = Router();
  router.post('/login', async (req, res, next) => {
    try {
      const { token, expiraEn, usuario } = await iniciarSesion.ejecutar(req.body);
      res.json({ token, expiraEn, usuario: aUsuarioJSON(usuario) });
    } catch (e) { next(e); }
  });
  router.get('/yo', conSesion, (req, res) => res.json(aUsuarioJSON(req.usuario)));
  router.post('/password', conSesion, async (req, res, next) => {
    try { await cambiarPassword.ejecutar(req.usuario, req.body); res.status(204).end(); } catch (e) { next(e); }
  });
  return router;
};

/** /api/usuarios — administradores y gerentes (el gerente solo maneja recepción y limpieza de su hotel, RN-76) */
export const usuarioRoutes = ({ crearUsuario, listarUsuarios, actualizarUsuario, restablecerPassword }) => {
  const router = Router();
  router.use(permitir('usuarios:gestionar'));
  const conPermiso = (req) => (u) => ({ ...aUsuarioJSON(u), editable: puedeGestionar(req.usuario, u) && u.id !== req.usuario.id });
  router.get('/', async (req, res, next) => {
    try { res.json((await listarUsuarios.ejecutar(req.usuario)).map(conPermiso(req))); } catch (e) { next(e); }
  });
  router.post('/', async (req, res, next) => {
    try { res.status(201).json(conPermiso(req)(await crearUsuario.ejecutar({ ...req.body }, req.usuario))); } catch (e) { next(e); }
  });
  router.patch('/:id', validarUUID('id', 'El usuario no existe'), async (req, res, next) => {
    try { res.json(conPermiso(req)(await actualizarUsuario.ejecutar(req.usuario, req.params.id, req.body))); } catch (e) { next(e); }
  });
  router.post('/:id/password', validarUUID('id', 'El usuario no existe'), async (req, res, next) => {
    try { await restablecerPassword.ejecutar(req.usuario, req.params.id, req.body); res.status(204).end(); } catch (e) { next(e); }
  });
  return router;
};
