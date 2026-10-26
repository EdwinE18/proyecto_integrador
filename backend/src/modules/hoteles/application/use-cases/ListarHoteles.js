export class ListarHoteles {
  constructor({ hotelRepository }) { this.repo = hotelRepository; }
  ejecutar() { return this.repo.listar(); }
}
