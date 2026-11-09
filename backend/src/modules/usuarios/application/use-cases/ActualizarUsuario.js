import { Usuario } from '../../domain/entities/Usuario.js';
import { AuthError } from '../../domain/errors/AuthError.js';
import { validarGestion } from '../../domain/politicaPersonal.js';

const EDITABLES = ['nombre', 'apellidos', 'rol', 'hotelId', 'activo', 'telegramChatId'];

export class ActualizarUsuario {
  constructor({ usuarioRepository }) { this.repo = usuarioRepository; }

  async ejecutar(solicitante, id, cambios = {}) {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new AuthError('El usuario no existe', 'RN-75', 404);
    validarGestion(solicitante, actual);                                  // ¿lo puede administrar hoy?

    const datos = Object.fromEntries(EDITABLES.filter((k) => k in cambios).map((k) => [k, cambios[k]]));
    if ('activo' in datos && typeof datos.activo !== 'boolean') throw new AuthError('"activo" debe ser verdadero o falso', 'RN-77', 400);
    if ('hotelId' in datos && datos.hotelId === '') datos.hotelId = null;

    // RN-77: nadie se desactiva, cambia de rol o de hotel a sí mismo (evita quedarse sin administrador)
    if (id === solicitante.id && ['rol', 'hotelId', 'activo'].some((k) => k in datos && datos[k] !== actual[k]))
      throw new AuthError('No puedes cambiar tu propio rol, hotel o acceso; pídeselo a otro administrador', 'RN-77', 409);

    const nuevo = new Usuario({ ...actual, ...datos });                   // RN-72, RN-75, RN-86
    validarGestion(solicitante, nuevo);                                   // ¿y como queda?
    return this.repo.actualizar(nuevo);
  }
}
