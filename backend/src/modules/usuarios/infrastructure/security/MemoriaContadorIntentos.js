import { ContadorIntentos } from '../../domain/ports/ContadorIntentos.js';

// RN-74 guardado en memoria. Limitación conocida: se reinicia si se reinicia el servidor
// y no se comparte entre varios servidores (para eso se usaría Redis o una tabla).
export class MemoriaContadorIntentos extends ContadorIntentos {
  constructor({ maximo = 5, ventanaMs = 15 * 60_000, ahora = () => Date.now() } = {}) {
    super(); Object.assign(this, { maximo, ventanaMs, ahora }); this.registros = new Map();
  }
  #vigente(clave) {
    const r = this.registros.get(clave);
    if (r && this.ahora() - r.desde > this.ventanaMs) { this.registros.delete(clave); return null; }
    return r ?? null;
  }
  bloqueo(clave) {
    const r = this.#vigente(clave);
    return r && r.fallos >= this.maximo ? r.desde + this.ventanaMs - this.ahora() : null;
  }
  registrarFallo(clave) {
    const r = this.#vigente(clave) ?? { fallos: 0, desde: this.ahora() };
    r.fallos++; this.registros.set(clave, r);
  }
  limpiar(clave) { this.registros.delete(clave); }
}
