// Middlewares de seguridad (adaptadores de entrada)
import { puede } from '../../domain/permisos.js';
import { AuthError } from '../../domain/errors/AuthError.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee "Authorization: Bearer <token>" y deja el usuario en req.usuario */
export const autenticar = ({ obtenerSesion }) => async (req, _res, next) => {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    req.usuario = await obtenerSesion.ejecutar(tipo === 'Bearer' ? token : null);
    next();
  } catch (e) { next(e); }
};

/** RN-72: el rol del usuario debe tener el permiso */
export const permitir = (permiso) => (req, _res, next) =>
  puede(req.usuario?.rol, permiso) ? next()
    : next(new AuthError('No tienes permiso para hacer esto', 'RN-72', 403));

/**
 * RN-75: el recurso debe ser del hotel del usuario.
 * @param {(req) => Promise<string|null> | string | null} obtenerHotelId
 */
export const soloSuHotel = (obtenerHotelId) => async (req, _res, next) => {
  try {
    if (req.usuario.esAdminGeneral) return next();
    const hotelId = await obtenerHotelId(req);
    if (!hotelId || !UUID.test(hotelId)) return next();      // si no existe, la ruta responderá 404
    return req.usuario.puedeVerHotel(hotelId) ? next()
      : next(new AuthError('No tienes acceso a este hotel', 'RN-75', 403));
  } catch (e) { next(e); }
};
