import { Usuario } from '../../domain/entities/Usuario.js';
export class CrearUsuario {
  constructor({ usuarioRepository, passwordHasher }) { Object.assign(this, { usuarioRepository, passwordHasher }); }
  async ejecutar({ password, ...datos } = {}) {
    const usuario = new Usuario(datos);                      // RN-72, RN-75
    Usuario.validarPassword(password);                       // RN-73
    return this.usuarioRepository.guardar(usuario, await this.passwordHasher.hashear(password));
  }
}
