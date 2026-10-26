// ADAPTADOR: "hoy" según el reloj del servidor, en la zona horaria de Chiapas.
// Importante en AWS: el servidor corre en UTC, y a las 8 p.m. en Chiapas allá ya es "mañana".
import { Reloj } from '../../../modules/reservaciones/domain/ports/Reloj.js';

export class RelojSistema extends Reloj {
  constructor(zonaHoraria = 'America/Mexico_City') { super(); this.zona = zonaHoraria; }
  hoy() {
    // en-CA da el formato YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.zona }).format(new Date());
  }
}
