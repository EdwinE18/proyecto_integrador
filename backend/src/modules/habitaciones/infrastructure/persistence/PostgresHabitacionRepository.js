import { HabitacionRepository } from '../../domain/ports/HabitacionRepository.js';
import { Habitacion } from '../../domain/entities/Habitacion.js';
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const SELECT = `
  SELECT h.id, h.hotel_id, h.numero, h.piso, h.estado, h.activo, t.id AS tipo_id, t.nombre AS tipo,
         t.capacidad_adultos, t.capacidad_ninos, t.precio_base, t.amenidades
  FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_id`;

const aEntidad = (f) => new Habitacion({
  id: f.id, hotelId: f.hotel_id, numero: f.numero, piso: f.piso, estado: f.estado, activo: f.activo,
  tipoId: f.tipo_id, tipo: f.tipo, capacidadAdultos: f.capacidad_adultos, capacidadNinos: f.capacidad_ninos,
  precioBase: Dinero.dePesos(f.precio_base), amenidades: f.amenidades,
});

export class PostgresHabitacionRepository extends HabitacionRepository {
  constructor(pool) { super(); this.pool = pool; }

  async listarPorHotel(hotelId) {
    const { rows } = await this.pool.query(`${SELECT} WHERE h.hotel_id = $1 AND h.activo ORDER BY h.piso NULLS LAST, h.numero`, [hotelId]);
    return rows.map(aEntidad);
  }

  async buscarPorId(id) {
    const { rows: [f] } = await this.pool.query(`${SELECT} WHERE h.id = $1`, [id]);
    return f ? aEntidad(f) : null;
  }

  async guardarEstado(habitacion, comentario) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      // El WHERE con el estado anterior evita pisar un cambio hecho al mismo tiempo por otra persona
      const r = await cliente.query('UPDATE habitaciones SET estado = $2 WHERE id = $1 AND estado = $3',
        [habitacion.id, habitacion.estado, habitacion.estadoAnterior]);
      if (r.rowCount === 0) throw Object.assign(new Error('La habitación cambió de estado mientras la editabas; recarga'), { status: 409 });
      // El trigger trg_habitacion_historial ya guardó el cambio (RN-22); aquí se le agrega el comentario
      if (comentario)
        await cliente.query(
          `UPDATE historial_habitacion SET comentario = $2
           WHERE id = (SELECT max(id) FROM historial_habitacion WHERE habitacion_id = $1)`, [habitacion.id, comentario]);
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally { cliente.release(); }
  }

  async disponibles(hotelId, rango, { adultos, ninos }) {
    const { rows } = await this.pool.query(`${SELECT}
      WHERE h.hotel_id = $1 AND h.activo
        AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
        AND t.capacidad_adultos >= $4 AND t.capacidad_ninos >= $5
        AND NOT EXISTS (
          SELECT 1 FROM reservaciones r
          WHERE r.habitacion_id = h.id AND r.estado IN ('pendiente', 'confirmada', 'check_in')
            AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange($2::date, $3::date, '[)'))
      ORDER BY t.precio_base, h.numero`, [hotelId, rango.entradaISO, rango.salidaISO, adultos, ninos]);
    return rows.map(aEntidad);
  }

  async reservacionesProximas(habitacionId, desdeISO) {
    const { rows } = await this.pool.query(
      `SELECT r.id, r.codigo, r.fecha_entrada, r.fecha_salida, r.estado, CONCAT(hu.nombre, ' ', hu.apellidos) AS huesped
       FROM reservaciones r JOIN huespedes hu ON hu.id = r.huesped_id
       WHERE r.habitacion_id = $1 AND r.estado IN ('pendiente', 'confirmada') AND r.fecha_salida > $2::date
       ORDER BY r.fecha_entrada`, [habitacionId, desdeISO]);
    return rows.map((f) => ({ id: f.id, codigo: f.codigo, entrada: f.fecha_entrada, salida: f.fecha_salida, estado: f.estado, huesped: f.huesped }));
  }
}
