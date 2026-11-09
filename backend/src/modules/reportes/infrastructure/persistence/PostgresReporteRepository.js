import { ReporteRepository } from '../../domain/ports/ReporteRepository.js';
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const ACTIVAS = "('confirmada', 'check_in', 'check_out')";   // reservaciones que sí ocupan la habitación

export class PostgresReporteRepository extends ReporteRepository {
  constructor(pool) { super(); this.pool = pool; }

  async datosDelPeriodo(hotelId, desde, hasta) {
    const q = (sql) => this.pool.query(sql, [hotelId, desde, hasta]).then((r) => r.rows);
    const [[hab], dias, cobrado, porCanal, porEstado, cancelaciones, [cobrar]] = await Promise.all([
      q(`SELECT COUNT(*)::int AS n FROM habitaciones WHERE hotel_id = $1 AND activo AND $2::date IS NOT NULL AND $3::date IS NOT NULL`),
      // Una fila por día: cuántas habitaciones estaban vendidas esa noche y cuánto se cobró por ellas
      q(`SELECT to_char(dia, 'YYYY-MM-DD') AS fecha, COUNT(r.id)::int AS ocupadas, COALESCE(SUM(r.precio_noche), 0) AS ingreso
         FROM generate_series($2::date, $3::date, interval '1 day') AS dia
         LEFT JOIN reservaciones r ON r.hotel_id = $1 AND r.estado IN ${ACTIVAS}
              AND dia::date >= r.fecha_entrada AND dia::date < r.fecha_salida
         GROUP BY dia ORDER BY dia`),
      q(`SELECT p.metodo::text AS metodo, SUM(p.monto) AS monto, COUNT(*)::int AS pagos
         FROM pagos p JOIN reservaciones r ON r.id = p.reservacion_id
         WHERE r.hotel_id = $1 AND (p.fecha_pago AT TIME ZONE 'America/Mexico_City')::date BETWEEN $2 AND $3
         GROUP BY p.metodo ORDER BY monto DESC`),
      q(`SELECT canal::text AS canal, COUNT(*)::int AS reservaciones FROM reservaciones
         WHERE hotel_id = $1 AND (created_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN $2 AND $3
         GROUP BY canal ORDER BY reservaciones DESC`),
      q(`SELECT estado::text AS estado, COUNT(*)::int AS reservaciones FROM reservaciones
         WHERE hotel_id = $1 AND daterange(fecha_entrada, fecha_salida, '[)') && daterange($2::date, $3::date + 1, '[)')
         GROUP BY estado ORDER BY reservaciones DESC`),
      q(`SELECT COALESCE(INITCAP(TRIM(motivo_cancelacion)), 'Sin motivo') AS motivo, COUNT(*)::int AS veces FROM reservaciones
         WHERE hotel_id = $1 AND estado = 'cancelada'
           AND (updated_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN $2 AND $3
         GROUP BY 1 ORDER BY veces DESC LIMIT 8`),
      q(`SELECT COALESCE(SUM(s.saldo), 0) AS saldo FROM v_saldo_reservaciones s JOIN reservaciones r ON r.id = s.id
         WHERE r.hotel_id = $1 AND r.estado IN ('confirmada', 'check_in') AND s.saldo > 0
           AND $2::date IS NOT NULL AND $3::date IS NOT NULL`),
    ]);
    return {
      habitaciones: hab.n,
      dias: dias.map((d) => ({ fecha: d.fecha, ocupadas: d.ocupadas, ingreso: Dinero.dePesos(d.ingreso) })),
      cobrado: cobrado.map((c) => ({ metodo: c.metodo, monto: Dinero.dePesos(c.monto), pagos: c.pagos })),
      porCanal, porEstado, cancelaciones,
      porCobrar: Dinero.dePesos(cobrar.saldo),
    };
  }
}
