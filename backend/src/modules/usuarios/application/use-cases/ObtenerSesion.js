import { AuthError } from '../../domain/errors/AuthError.js';

// Convierte un token en el usuario actual. Se consulta la BD en cada petición para que
// desactivar a un usuario le quite el acceso al instante (no hasta que expire su token).
export class ObtenerSesion {
  constructor({ usuarioRepository, tokenService }) { Object.assign(this, { usuarioRepository, tokenService }); }

  async ejecutar(token) {
    if (!token) throw new AuthError('Inicia sesión para continuar', 'RN-71');
    let datos;
    try { datos = this.tokenService.verificar(token); }
    catch { throw new AuthError('Tu sesión expiró o no es válida; inicia sesión de nuevo', 'RN-71'); }
    const usuario = await this.usuarioRepository.buscarPorId(datos.sub);
    if (!usuario || !usuario.activo) throw new AuthError('Tu usuario ya no tiene acceso', 'RN-71');
    return usuario;
  }
}
