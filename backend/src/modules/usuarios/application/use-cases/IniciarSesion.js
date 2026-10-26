import { AuthError } from '../../domain/errors/AuthError.js';

// Hash de una contraseña inventada: se compara aunque el correo no exista, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué correos están registrados.
const HASH_FALSO = '$2b$10$JiaqmDEU0QN8v6vnQMphX.b7vhCTGlfWQdEpnYNgsUCBZeDkuOA5u';
const MENSAJE = 'Correo o contraseña incorrectos';   // RN-71: nunca decir cuál de los dos falló

export class IniciarSesion {
  constructor({ usuarioRepository, passwordHasher, tokenService, contadorIntentos }) {
    Object.assign(this, { usuarioRepository, passwordHasher, tokenService, contadorIntentos });
  }

  async ejecutar({ email, password } = {}) {
    const clave = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!clave || typeof password !== 'string' || !password) throw new AuthError(MENSAJE, 'RN-71');

    // RN-74: 5 intentos fallidos → 15 minutos de bloqueo
    const espera = this.contadorIntentos.bloqueo(clave);
    if (espera) throw new AuthError(
      `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(espera / 60000)} minuto(s)`, 'RN-74', 429);

    const encontrado = await this.usuarioRepository.buscarPorEmailConPassword(clave);
    const ok = await this.passwordHasher.verificar(password, encontrado?.passwordHash ?? HASH_FALSO);
    if (!encontrado || !ok) {
      this.contadorIntentos.registrarFallo(clave);
      throw new AuthError(MENSAJE, 'RN-71');
    }
    if (!encontrado.usuario.activo) throw new AuthError('Tu usuario está desactivado; habla con el administrador', 'RN-71', 403);

    this.contadorIntentos.limpiar(clave);
    await this.usuarioRepository.registrarAcceso(encontrado.usuario.id);
    return { ...this.tokenService.firmar(encontrado.usuario), usuario: encontrado.usuario };
  }
}
