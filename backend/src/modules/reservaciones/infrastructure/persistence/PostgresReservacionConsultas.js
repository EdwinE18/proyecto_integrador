import { ReservacionConsultas } from '../../domain/ports/ReservacionConsultas.js';

const SELECT = `
  SELECT r.id, r.codigo, r.hotel_id, r.estado, r.canal, r.fecha_entrada, r.fecha_salida, r.noches,
         r.num_adultos, r.num_ninos, r.precio_noche, r.total, r.motivo_cancelacion, r.created_at,
         s.pagado, s.saldo,
         hu.id AS huesped_id, CONCAT(hu.nombre, ' ', hu.apellidos) AS huesped, hu.telefono, hu.email,
         hab.id AS habitacion_id, hab.numero, hab.estado AS estado_habitacion, t.nombre AS tipo,
         e.check_in_real, e.check_out_real, e.placas_vehiculo, e.observaciones
  FROM reservaciones r
  JOIN v_saldo_reservaciones s ON s.id = r.id
  JOIN huespedes hu ON hu.id = r.huesped_id
  JOIN habitaciones hab ON hab.id = r.habitacion_id
  JOIN tipos_habitacion t ON t.id = hab.tipo_id
  LEFT JOIN estancias e ON e.reservacion_id = r.id`;

const n = (v) => (v === null || v === undefined ? null : Number(v));
const aDTO = (f) => ({
  id: f.id, codigo: f.codigo, hotelId: f.hotel_id, estado: f.estado, canal: f.canal,
  entrada: f.fecha_entrada, salida: f.fecha_salida, noches: f.noches,
  numAdultos: f.num_adultos, numNinos: f.num_ninos,
  precioNoche: n(f.precio_noche), total: n(f.total), pagado: n(f.pagado), saldo: n(f.saldo),
  motivoCancelacion: f.motivo_cancelacion, creadaEn: f.created_at,
  huesped: { id: f.huesped_id, nombre: f.huesped, telefono: f.telefono, email: f.email },
  habitacion: { id: f.habitacion_id, numero: f.numero, tipo: f.tipo, estado: f.estado_habitacion },
  estancia: f.check_in_real ? { checkInReal: f.check_in_real, checkOutReal: f.check_out_real,
                                placasVehiculo: f.placas_vehiculo, observaciones: f.observaciones } : null,
});

export class PostgresReservacionConsultas extends ReservacionConsultas {
  constructor(pool) { super(); this.pool = pool; }

  async agenda(hotelId, { desde, hasta, estados }) {
    const { rows } = await this.pool.query(`${SELECT}
      WHERE r.hotel_id = $1
        AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange($2::date, $3::date, '[)')
        AND (cardinality($4::text[]) = 0 OR r.estado::text = ANY($4::text[]))
      ORDER BY r.fecha_entrada, hab.numero`, [hotelId, desde, hasta, estados]);
    return rows.map(aDTO);
  }

  async detalle(id) {
    const { rows: [f] } = await this.pool.query(`${SELECT} WHERE r.id = $1`, [id]);
    return f ? aDTO(f) : null;
  }
}
