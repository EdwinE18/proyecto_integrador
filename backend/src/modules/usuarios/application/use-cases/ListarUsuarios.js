export class ListarUsuarios {
  constructor({ usuarioRepository }) { this.repo = usuarioRepository; }
  ejecutar(solicitante) { return this.repo.listar(solicitante.esAdminGeneral ? null : solicitante.hotelId); }
}
