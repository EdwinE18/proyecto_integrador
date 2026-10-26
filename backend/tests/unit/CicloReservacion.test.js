import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Reservacion } from '../../src/modules/reservaciones/domain/entities/Reservacion.js';
import { ConfirmarReservacion } from '../../src/modules/reservaciones/application/use-cases/ConfirmarReservacion.js';
import { CancelarReservacion } from '../../src/modules/reservaciones/application/use-cases/CancelarReservacion.js';

const nueva = (estado = 'pendiente') => new Reservacion({
  id: 'r1', codigo: 'ABC12345', hotelId: 'h1', huespedId: 'g', habitacionId: 'hab',
  entrada: '2026-12-01', salida: '2026-12-03', numAdultos: 1, precioNoche: 900, estado,
});

// Repositorio en memoria: guarda una sola reservación
function repoCon(reservacion) {
  const llamadas = { actualizar: 0, eventos: [] };
  const repo = {
    buscarPorId: async (id) => (reservacion && id === reservacion.id ? reservacion : null),
    actualizarEstado: async (r) => { llamadas.actualizar++; return r; },
  };
  const eventos = { publicar: async (tipo, _id, payload) => { llamadas.eventos.push({ tipo, payload }); } };
  return { deps: { reservacionRepository: repo, eventPublisher: eventos }, llamadas };
}

describe('RN-09 Confirmar reservación', () => {
  test('pendiente → confirmada y publica evento', async () => {
    const { deps, llamadas } = repoCon(nueva('pendiente'));
    const r = await new ConfirmarReservacion(deps).ejecutar('r1');
    assert.equal(r.estado, 'confirmada');
    assert.equal(llamadas.actualizar, 1);
    assert.equal(llamadas.eventos[0].tipo, 'reservacion.confirmada');
  });

  for (const estado of ['confirmada', 'cancelada', 'check_in', 'check_out', 'no_show']) {
    test(`no se puede confirmar si está ${estado}`, async () => {
      const { deps, llamadas } = repoCon(nueva(estado));
      await assert.rejects(new ConfirmarReservacion(deps).ejecutar('r1'), { regla: 'RN-09' });
      assert.equal(llamadas.actualizar, 0);
    });
  }

  test('reservación inexistente → 404', async () => {
    const { deps } = repoCon(null);
    await assert.rejects(new ConfirmarReservacion(deps).ejecutar('no-existe'), { status: 404 });
  });
});

describe('RN-10 / RN-12 Cancelar reservación', () => {
  for (const estado of ['pendiente', 'confirmada']) {
    test(`se cancela si está ${estado} y guarda el motivo`, async () => {
      const { deps, llamadas } = repoCon(nueva(estado));
      const r = await new CancelarReservacion(deps).ejecutar('r1', '  El huésped   cambió de fecha ');
      assert.equal(r.estado, 'cancelada');
      assert.equal(r.motivoCancelacion, 'El huésped cambió de fecha');   // espacios limpiados
      assert.equal(llamadas.eventos[0].tipo, 'reservacion.cancelada');
      assert.equal(llamadas.eventos[0].payload.motivo, 'El huésped cambió de fecha');
    });
  }

  for (const estado of ['check_in', 'check_out', 'cancelada', 'no_show']) {
    test(`RN-10 no se cancela si está ${estado}`, async () => {
      const { deps, llamadas } = repoCon(nueva(estado));
      await assert.rejects(new CancelarReservacion(deps).ejecutar('r1', 'Motivo válido'), { regla: 'RN-10' });
      assert.equal(llamadas.actualizar, 0);
    });
  }

  for (const motivo of [undefined, '', '   ', 'no', 123]) {
    test(`RN-12 rechaza motivo inválido: ${JSON.stringify(motivo)}`, async () => {
      const { deps, llamadas } = repoCon(nueva('confirmada'));
      await assert.rejects(new CancelarReservacion(deps).ejecutar('r1', motivo), { status: 400, regla: 'RN-12' });
      assert.equal(llamadas.actualizar, 0);
    });
  }
});
