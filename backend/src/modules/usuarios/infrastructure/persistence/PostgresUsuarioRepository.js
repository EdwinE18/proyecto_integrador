import { UsuarioRepository } from '../../domain/ports/UsuarioRepository.js';
import { Usuario } from '../../domain/entities/Usuario.js';
import { AuthError } from '../../domain/errors/AuthError.js';

const aUsuario = (f) => new Usuario({
  id: f.id, hotelId: f.hotel_id, nombre: f.nombre, apellidos: f.apellidos, email: f.email,
  rol: f.rol, activo: f.activo, ultimoAcceso: f.ultimo_acceso,
});

export class PostgresUsuarioRepository extends UsuarioRepository {
  constructor(pool) { super(); this.pool = pool; }

  async buscarPorEmailConPassword(email) {
    const { rows: [f] } = await this.pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    return f ? { usuario: aUsuario(f), passwordHash: f.password_hash } : null;
  }
  async buscarPorId(id) {
    const { rows: [f] } = await this.pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return f ? aUsuario(f) : null;
  }
  async listar(hotelId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM usuarios WHERE ($1::uuid IS NULL OR hotel_id = $1) ORDER BY rol, apellidos', [hotelId]);
    return rows.map(aUsuario);
  }
  async guardar(u, passwordHash) {
    try {
      const { rows: [f] } = await this.pool.query(
        `INSERT INTO usuarios (hotel_id, nombre, apellidos, email, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [u.hotelId, u.nombre, u.apellidos, u.email, passwordHash, u.rol]);
      return aUsuario(f);
    } catch (e) {
      if (e.code === '23505') throw new AuthError('Ya existe un usuario con ese correo', 'RN-70', 409);
      if (e.code === '23503') throw new AuthError('El hotel no existe', 'RN-75', 400);
      throw e;
    }
  }
  async cambiarPassword(id, passwordHash) {
    await this.pool.query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
  }
  async registrarAcceso(id) {
    await this.pool.query('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [id]);
  }
}
