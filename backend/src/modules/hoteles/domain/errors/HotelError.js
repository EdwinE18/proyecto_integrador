export class HotelError extends Error {
  constructor(msg, regla, status = 400) { super(msg); this.name = 'HotelError'; this.regla = regla; this.status = status; }
}
