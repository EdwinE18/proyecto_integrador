// Guarda los eventos en la tabla eventos_dominio (patrón outbox).
// n8n los lee con fn_tomar_notificaciones() y los envía por Telegram (database/09_notificaciones.sql).
import { EventPublisher } from '../../../modules/reservaciones/domain/ports/EventPublisher.js';

// 'habitacion.estado_cambiado' pertenece a una habitación; reservaciones, pagos y estancias, a una reservación
const agregadoDe = (tipo) => (tipo.startsWith('habitacion.') ? 'habitacion' : 'reservacion');

export class PostgresOutboxPublisher extends EventPublisher {
  constructor(pool) { super(); this.pool = pool; }
  async publicar(tipo, agregadoId, payload) {
    await this.pool.query(
      'INSERT INTO eventos_dominio (tipo, agregado, agregado_id, payload) VALUES ($1,$2,$3,$4)',
      [tipo, agregadoDe(tipo), agregadoId, payload]);
  }
}
