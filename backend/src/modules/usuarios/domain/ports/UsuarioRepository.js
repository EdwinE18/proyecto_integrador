export class UsuarioRepository {
  /** @returns {Promise<{ usuario: Usuario, passwordHash: string } | null>} */
  async buscarPorEmailConPassword(email) { throw new Error('No implementado'); }
  async buscarPorId(id) { throw new Error('No implementado'); }
  async listar(hotelId) { throw new Error('No implementado'); }
  async guardar(usuario, passwordHash) { throw new Error('No implementado'); }
  async cambiarPassword(id, passwordHash) { throw new Error('No implementado'); }
  async registrarAcceso(id) { throw new Error('No implementado'); }
}
