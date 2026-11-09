import { Usuario } from '../../domain/entities/Usuario.js';
import { validarGestion } from '../../domain/politicaPersonal.js';

export class CrearUsuario {
  constructor({ usuarioRepository, passwordHasher }) { Object.assign(this, { usuarioRepository, passwordHasher }); }
  async ejecutar({ password, ...datos } = {}, solicitante = null) {
    // Quien no es admin general crea usuarios de su propio hotel
    if (solicitante && !solicitante.esAdminGeneral && !datos.hotelId) datos.hotelId = solicitante.hotelId;
    const usuario = new Usuario(datos);                      // RN-72, RN-75
    if (solicitante) validarGestion(solicitante, usuario);   // RN-75, RN-76
    Usuario.validarPassword(password);                       // RN-73
    return this.usuarioRepository.guardar(usuario, await this.passwordHasher.hashear(password));
  }
}
