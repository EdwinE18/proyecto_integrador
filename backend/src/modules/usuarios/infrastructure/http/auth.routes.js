import { Router } from 'express';
import { permitir } from './auth.middleware.js';

export const aUsuarioJSON = (u) => ({
  id: u.id, hotelId: u.hotelId, nombre: u.nombre, apellidos: u.apellidos, email: u.email,
  rol: u.rol, activo: u.activo, ultimoAcceso: u.ultimoAcceso, permisos: u.permisos,
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

/** /api/usuarios — solo administradores */
export const usuarioRoutes = ({ crearUsuario, listarUsuarios }) => {
  const router = Router();
  router.use(permitir('usuarios:gestionar'));
  router.get('/', async (req, res, next) => {
    try { res.json((await listarUsuarios.ejecutar(req.usuario)).map(aUsuarioJSON)); } catch (e) { next(e); }
  });
  router.post('/', async (req, res, next) => {
    try {
      // Un admin de hotel solo crea usuarios de su propio hotel
      const datos = req.usuario.esAdminGeneral ? req.body : { ...req.body, hotelId: req.usuario.hotelId };
      res.status(201).json(aUsuarioJSON(await crearUsuario.ejecutar(datos)));
    } catch (e) { next(e); }
  });
  return router;
};
