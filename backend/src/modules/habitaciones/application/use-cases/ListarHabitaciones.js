export class ListarHabitaciones {
  constructor({ habitacionRepository }) { this.repo = habitacionRepository; }
  ejecutar(hotelId) { return this.repo.listarPorHotel(hotelId); }
}
