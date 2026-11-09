import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndicadores } from '../../src/modules/reportes/domain/services/Indicadores.js';
import { GenerarReporte } from '../../src/modules/reportes/application/use-cases/GenerarReporte.js';
import { Dinero } from '../../src/modules/pagos/domain/value-objects/Dinero.js';

const dia = (fecha, ocupadas, pesos) => ({ fecha, ocupadas, ingreso: Dinero.dePesos(pesos) });

describe('Indicadores hoteleros', () => {
  test('ocupación, ADR y RevPAR de 4 cuartos en 2 días', () => {
    // 8 noches disponibles; se vendieron 3 + 1 = 4 por $3,000 + $1,000
    const r = calcularIndicadores({ habitaciones: 4, dias: [dia('2026-11-01', 3, 3000), dia('2026-11-02', 1, 1000)] });
    assert.equal(r.nochesDisponibles, 8);
    assert.equal(r.nochesVendidas, 4);
    assert.equal(r.ocupacion, 50);
    assert.equal(r.adr.pesos, 1000);        // 4000 / 4 noches vendidas
    assert.equal(r.revpar.pesos, 500);      // 4000 / 8 noches disponibles
    assert.deepEqual(r.porDia.map((d) => d.ocupacion), [75, 25]);
  });
  test('sin ventas ni habitaciones no divide entre cero', () => {
    const r = calcularIndicadores({ habitaciones: 0, dias: [dia('2026-11-01', 0, 0)] });
    assert.equal(r.ocupacion, 0); assert.equal(r.adr.pesos, 0); assert.equal(r.revpar.pesos, 0);
  });
  test('redondea a centavos sin errores de punto flotante', () => {
    const r = calcularIndicadores({ habitaciones: 3, dias: [dia('2026-11-01', 3, 1000)] });
    assert.equal(r.adr.pesos, 333.33);
    assert.equal(r.ocupacion, 100);
  });
});

describe('GenerarReporte (RN-78)', () => {
  const repo = { pedido: null, async datosDelPeriodo(h, d, a) {
    this.pedido = [h, d, a];
    return { habitaciones: 2, dias: [dia(d, 1, 800)], cobrado: [{ metodo: 'efectivo', monto: Dinero.dePesos(500), pagos: 1 },
      { metodo: 'tarjeta', monto: Dinero.dePesos(250.5), pagos: 1 }], porCanal: [], porEstado: [], cancelaciones: [], porCobrar: Dinero.dePesos(300) };
  } };
  const caso = new GenerarReporte({ reporteRepository: repo, reloj: { hoy: () => '2026-11-09' } });

  test('por omisión toma los últimos 30 días', async () => {
    await caso.ejecutar('h1');
    assert.deepEqual(repo.pedido, ['h1', '2026-10-11', '2026-11-09']);
  });
  test('suma lo cobrado por método', async () => {
    const r = await caso.ejecutar('h1', { desde: '2026-11-01', hasta: '2026-11-01' });
    assert.equal(r.cobrado.pesos, 750.5);
    assert.equal(r.ocupacion, 50);
  });
  for (const [caso_, q] of [['fecha mal escrita', { desde: '01/11/2026' }], ['hasta antes de desde', { desde: '2026-11-05', hasta: '2026-11-01' }],
    ['más de un año', { desde: '2025-01-01', hasta: '2026-11-01' }]])
    test(`rechaza: ${caso_}`, () => assert.rejects(caso.ejecutar('h1', q), { regla: 'RN-78' }));
});
