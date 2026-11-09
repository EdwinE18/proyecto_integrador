export class ConsultarTarifas {
  constructor({ tarifaRepository }) { this.repo = tarifaRepository; }
  ejecutar(hotelId) { return this.repo.listarPorHotel(hotelId); }
}
