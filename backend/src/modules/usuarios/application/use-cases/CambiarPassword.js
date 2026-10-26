import { Usuario } from '../../domain/entities/Usuario.js';
import { AuthError } from '../../domain/errors/AuthError.js';
export class CambiarPassword {
  constructor({ usuarioRepository, passwordHasher }) { Object.assign(this, { usuarioRepository, passwordHasher }); }
  async ejecutar(usuario, { actual, nueva } = {}) {
    const encontrado = await this.usuarioRepository.buscarPorEmailConPassword(usuario.email);
    if (!encontrado || !(await this.passwordHasher.verificar(actual ?? '', encontrado.passwordHash)))
      throw new AuthError('La contraseña actual no es correcta', 'RN-71', 400);
    Usuario.validarPassword(nueva);                          // RN-73
    if (actual === nueva) throw new AuthError('La nueva contraseña debe ser distinta a la actual', 'RN-73', 400);
    await this.usuarioRepository.cambiarPassword(usuario.id, await this.passwordHasher.hashear(nueva));
  }
}
