import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService.js';

// El token solo lleva el id del usuario: rol y permisos se leen de la BD en cada petición.
export class JwtTokenService extends TokenService {
  constructor(secreto, duracion = '8h') {   // 8 horas = un turno de recepción
    super();
    if (!secreto || secreto.length < 16)
      throw new Error('Configura JWT_SECRET en backend/.env (mínimo 16 caracteres). Genera uno con: openssl rand -hex 32');
    this.secreto = secreto;
    this.duracion = duracion;
  }
  firmar(usuario) {
    const token = jwt.sign({ sub: usuario.id }, this.secreto, { expiresIn: this.duracion, algorithm: 'HS256' });
    return { token, expiraEn: new Date(jwt.decode(token).exp * 1000).toISOString() };
  }
  verificar(token) { return jwt.verify(token, this.secreto, { algorithms: ['HS256'] }); }
}
