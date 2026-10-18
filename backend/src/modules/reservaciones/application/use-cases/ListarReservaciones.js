export class ListarReservaciones {
  constructor({ reservacionRepository }) { this.repo = reservacionRepository; }
  ejecutar(hotelId, rango) { return this.repo.listarPorHotel(hotelId, rango); }
}
