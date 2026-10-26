import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsultarAgenda } from '../../src/modules/reservaciones/application/use-cases/ConsultarAgenda.js';

const uc = () => {
  const llamadas = [];
  return { llamadas, uc: new ConsultarAgenda({
    reservacionConsultas: { agenda: async (h, f) => { llamadas.push(f); return []; }, detalle: async () => null },
    reloj: { hoy: () => '2026-12-31' } }) };
};

test('por defecto consulta hoy y mañana (aunque cambie el año)', async () => {
  const { uc: u, llamadas } = uc();
  const r = await u.ejecutar('h');
  assert.deepEqual([r.desde, r.hasta], ['2026-12-31', '2027-01-01']);
  assert.deepEqual(llamadas[0].estados, []);
});
test('filtra por estados válidos y rechaza inventados', async () => {
  const { uc: u, llamadas } = uc();
  await u.ejecutar('h', { desde: '2026-12-01', hasta: '2026-12-31', estados: 'confirmada,check_in' });
  assert.deepEqual(llamadas[0].estados, ['confirmada', 'check_in']);
  await assert.rejects(u.ejecutar('h', { estados: 'borrada' }), { status: 400 });
});
test('rango máximo de un año', async () => {
  await assert.rejects(uc().uc.ejecutar('h', { desde: '2026-01-01', hasta: '2027-06-01' }), { status: 400 });
});
test('detalle inexistente → 404', async () => {
  await assert.rejects(uc().uc.detalle('x'), { status: 404 });
});
