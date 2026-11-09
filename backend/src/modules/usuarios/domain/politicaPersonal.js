// RN-75 / RN-76 / RN-77: quién puede administrar a quién.
import { AuthError } from './errors/AuthError.js';

const ROLES_DEL_GERENTE = ['recepcion', 'limpieza'];

/**
 * ¿El solicitante puede tener a su cargo un usuario con este rol y hotel?
 * Lanza AuthError si no. Se revisa el estado ANTES y DESPUÉS de cada cambio.
 */
export function validarGestion(solicitante, { rol, hotelId }) {
  if (solicitante.esAdminGeneral) return;
  // RN-75: un admin o gerente de hotel solo maneja personal de su hotel
  if (hotelId !== solicitante.hotelId) throw new AuthError('Solo puedes administrar personal de tu hotel', 'RN-75', 403);
  // RN-76: el gerente maneja recepción y limpieza, no a otros gerentes ni administradores
  if (solicitante.rol === 'gerente' && !ROLES_DEL_GERENTE.includes(rol))
    throw new AuthError('Como gerente solo puedes administrar usuarios de recepción y limpieza', 'RN-76', 403);
}

export const puedeGestionar = (solicitante, usuario) => {
  try { validarGestion(solicitante, usuario); return true; } catch { return false; }
};
