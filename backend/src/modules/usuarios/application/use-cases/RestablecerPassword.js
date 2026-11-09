import { Usuario } from '../../domain/entities/Usuario.js';
import { AuthError } from '../../domain/errors/AuthError.js';
import { validarGestion } from '../../domain/politicaPersonal.js';

/** Un administrador o gerente asigna una contraseña nueva a alguien de su personal (por si la olvidó). */
export class RestablecerPassword {
  constructor({ usuarioRepository, passwordHasher }) { Object.assign(this, { repo: usuarioRepository, passwordHasher }); }

  async ejecutar(solicitante, id, { password } = {}) {
    const usuario = await this.repo.buscarPorId(id);
    if (!usuario) throw new AuthError('El usuario no existe', 'RN-75', 404);
    if (usuario.id === solicitante.id) throw new AuthError('Para tu propia contraseña usa "Mi cuenta"', 'RN-77', 409);
    validarGestion(solicitante, usuario);                // RN-75, RN-76
    Usuario.validarPassword(password);                   // RN-73
    await this.repo.cambiarPassword(id, await this.passwordHasher.hashear(password));
  }
}
