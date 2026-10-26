import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Dinero } from '../../src/modules/pagos/domain/value-objects/Dinero.js';
import { Pago } from '../../src/modules/pagos/domain/entities/Pago.js';
import { CuentaReservacion } from '../../src/modules/pagos/domain/entities/CuentaReservacion.js';
import { RegistrarPago } from '../../src/modules/pagos/application/use-cases/RegistrarPago.js';

describe('Dinero (centavos enteros)', () => {
  test('0.10 + 0.20 da exactamente 0.30 (en float daría 0.30000000000000004)', () => {
    assert.equal(Dinero.dePesos('0.10').sumar(Dinero.dePesos('0.20')).toString(), '0.30');
  });
  test('acepta distintos formatos', () => {
    assert.equal(Dinero.dePesos(1500).centavos, 150000);
    assert.equal(Dinero.dePesos('1,500.5').centavos, 150050);
    assert.equal(Dinero.dePesos('1100.00').toString(), '1100.00');
  });
  for (const malo of ['abc', '', '10.999', '1e3', null]) {
    test(`rechaza ${JSON.stringify(malo)}`, () => assert.throws(() => Dinero.dePesos(malo), { regla: 'RN-50' }));
  }
});

describe('Pago', () => {
  test('RN-50 rechaza monto cero o negativo', () => {
    assert.throws(() => new Pago({ monto: 0, metodo: 'efectivo' }), { regla: 'RN-50' });
    assert.throws(() => new Pago({ monto: -100, metodo: 'efectivo' }), { regla: 'RN-50' });
  });
  test('RN-50 rechaza método inválido', () => {
    assert.throws(() => new Pago({ monto: 100, metodo: 'bitcoin' }), { regla: 'RN-50' });
  });
  test('RN-56 transferencia sin referencia se rechaza', () => {
    assert.throws(() => new Pago({ monto: 100, metodo: 'transferencia' }), { regla: 'RN-56' });
  });
  test('la referencia se limpia y pasa a mayúsculas', () => {
    assert.equal(new Pago({ monto: 100, metodo: 'transferencia', referencia: '  spei  ab12 ' }).referencia, 'SPEI AB12');
  });
});

const cuentaCon = (estado, pagos = []) => new CuentaReservacion({
  reservacionId: 'r1', codigo: 'ABC', estado, total: Dinero.dePesos(1000),
  pagos: pagos.map((m) => new Pago({ monto: m, metodo: 'efectivo' })),
});

describe('CuentaReservacion', () => {
  test('RN-51 calcula pagado y saldo', () => {
    const c = cuentaCon('confirmada', [300, '200.50']);
    assert.equal(c.pagado.toString(), '500.50');
    assert.equal(c.saldo.toString(), '499.50');
    assert.equal(c.liquidada, false);
  });
  test('RN-54 rechaza pagar más que el saldo', () => {
    assert.throws(() => cuentaCon('confirmada', [600]).validarPago(new Pago({ monto: 401, metodo: 'efectivo' })), { regla: 'RN-54' });
  });
  test('RN-54 acepta pagar exactamente el saldo', () => {
    cuentaCon('confirmada', [600]).validarPago(new Pago({ monto: 400, metodo: 'efectivo' }));
  });
  for (const estado of ['cancelada', 'check_out', 'no_show']) {
    test(`RN-55 rechaza pagos si está ${estado}`, () => {
      assert.throws(() => cuentaCon(estado).validarPago(new Pago({ monto: 1, metodo: 'efectivo' })), { regla: 'RN-55', status: 409 });
    });
  }
});

describe('Caso de uso RegistrarPago', () => {
  test('registra el pago, actualiza el saldo y publica el evento', async () => {
    const cuenta = cuentaCon('confirmada', [600]);
    const eventos = [];
    const uc = new RegistrarPago({
      pagoRepository: { obtenerCuenta: async () => cuenta, guardar: async (p) => Object.assign(p, { id: 'p1' }) },
      eventPublisher: { publicar: async (tipo, _id, payload) => eventos.push({ tipo, payload }) },
    });
    const { pago, cuenta: c } = await uc.ejecutar('r1', { monto: '400', metodo: 'tarjeta' });
    assert.equal(pago.id, 'p1');
    assert.equal(c.liquidada, true);
    assert.deepEqual(eventos[0], { tipo: 'pago.registrado', payload: { codigo: 'ABC', monto: '400.00', saldo: '0.00' } });
  });
  test('reservación inexistente → 404', async () => {
    const uc = new RegistrarPago({ pagoRepository: { obtenerCuenta: async () => null }, eventPublisher: {} });
    await assert.rejects(uc.ejecutar('x', { monto: 1, metodo: 'efectivo' }), { status: 404 });
  });
});
