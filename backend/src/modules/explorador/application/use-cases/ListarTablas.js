export class ListarTablas {
  constructor({ esquemaRepository }) { this.repo = esquemaRepository; }
  ejecutar() { return this.repo.listarTablas(); }
}
