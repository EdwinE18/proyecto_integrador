// Guarda los eventos en la tabla eventos_dominio (patrón outbox).
// n8n y Node-RED consultan esa tabla y disparan sus flujos (Telegram, reportes, etc.).
import { EventPublisher } from '../../../modules/reservaciones/domain/ports/EventPublisher.js';

export class PostgresOutboxPublisher extends EventPublisher {
  constructor(pool, agregado = 'reservacion') { super(); this.pool = pool; this.agregado = agregado; }
  async publicar(tipo, agregadoId, payload) {
    await this.pool.query(
      'INSERT INTO eventos_dominio (tipo, agregado, agregado_id, payload) VALUES ($1,$2,$3,$4)',
      [tipo, this.agregado, agregadoId, payload]);
  }
}
