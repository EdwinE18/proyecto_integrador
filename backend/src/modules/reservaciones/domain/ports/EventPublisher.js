// Puerto para publicar eventos (lo implementa el outbox que leen n8n / Node-RED)
export class EventPublisher {
  async publicar(tipo, agregadoId, payload) { throw new Error('No implementado'); }
}
