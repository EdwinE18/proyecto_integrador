export class TokenService {
  /** @returns {{ token: string, expiraEn: string }} */
  firmar(usuario) { throw new Error('No implementado'); }
  /** @returns {{ sub: string }} o lanza error si el token es inválido o expiró */
  verificar(token) { throw new Error('No implementado'); }
}
