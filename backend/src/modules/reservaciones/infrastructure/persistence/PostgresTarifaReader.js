import { TarifaReader } from '../../domain/ports/TarifaReader.js';
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

export class PostgresTarifaReader extends TarifaReader {
  constructor(pool) { super(); this.pool = pool; }

  async temporadas(tipoHabitacionId, rango) {
    const { rows } = await this.pool.query(
      `SELECT nombre, fecha_inicio, fecha_fin, precio_noche
       FROM tarifas_temporada
       WHERE tipo_id = $1
         AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($2::date, $3::date, '[)')
       ORDER BY fecha_inicio`, [tipoHabitacionId, rango.entradaISO, rango.salidaISO]);
    return rows.map((r) => ({
      nombre: r.nombre, inicio: r.fecha_inicio, fin: r.fecha_fin, precio: Dinero.dePesos(r.precio_noche),
    }));
  }
}
