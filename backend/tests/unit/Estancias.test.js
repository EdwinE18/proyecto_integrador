import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Reservacion } from '../../src/modules/reservaciones/domain/entities/Reservacion.js';
import { Estancia } from '../../src/modules/estancias/domain/entities/Estancia.js';
import { RegistrarCheckIn } from '../../src/modules/estancias/application/use-cases/RegistrarCheckIn.js';
import { RegistrarCheckOut } from '../../src/modules/estancias/application/use-cases/RegistrarCheckOut.js';
import { CuentaReservacion } from '../../src/modules/pagos/domain/entities/CuentaReservacion.js';
import { Dinero } from '../../src/modules/pagos/domain/value-objects/Dinero.js';

const reservacion = (estado) => new Reservacion({
  id: 'r1', codigo: 'ABC', hotelId: 'h1', huespedId: 'g', habitacionId: 'hab',
  entrada: '2026-12-20', salida: '2026-12-22', numAdultos: 1, precioNoche: 500, estado,
});
const habitacion = (estado = 'disponible') => ({ id: 'hab', hotelId: 'h1', numero: '201', estado, activo: true,
  capacidadAdultos: 2, capacidadNinos: 0 });

function deps({ estado = 'confirmada', estadoHab = 'disponible', hoy = '2026-12-20', saldo = 0 } = {}) {
  const llamadas = { checkIn: 0, checkOut: 0, eventos: [] };
  const r = reservacion(estado);
  return {
    llamadas,
    d: {
      reservacionRepository: { buscarPorId: async () => r },
      habitacionReader: { obtenerParaReservar: async () => habitacion(estadoHab) },
      // Cuenta sin pagos cuyo total es el saldo que se quiere simular
      pagoRepository: { obtenerCuenta: async () =>
        new CuentaReservacion({ reservacionId: 'r1', estado, total: Dinero.dePesos(saldo), pagos: [] }) },
      estanciaRepository: {
        registrarCheckIn: async ({ estancia }) => { llamadas.checkIn++; return Object.assign(estancia, { id: 'e1' }); },
        registrarCheckOut: async () => { llamadas.checkOut++; return new Estancia({ id: 'e1', reservacionId: 'r1' }); },
      },
      reloj: { hoy: () => hoy },
      eventPublisher: { publicar: async (tipo) => llamadas.eventos.push(tipo) },
    },
  };
}

describe('Estancia', () => {
  test('RN-46 normaliza las placas', () => {
    assert.equal(new Estancia({ placasVehiculo: ' dbc-12 34 ' }).placasVehiculo, 'DBC1234');
    assert.equal(new Estancia({ placasVehiculo: '' }).placasVehiculo, null);
  });
  test('RN-46 rechaza placas demasiado cortas o largas', () => {
    assert.throws(() => new Estancia({ placasVehiculo: 'AB1' }), { regla: 'RN-46' });
    assert.throws(() => new Estancia({ placasVehiculo: 'ABCDEFGHIJK' }), { regla: 'RN-46' });
  });
});

describe('Check-in', () => {
  test('confirmada + día de entrada + cuarto listo → check_in', async () => {
    const { d, llamadas } = deps();
    const res = await new RegistrarCheckIn(d).ejecutar('r1', { placas: 'abc-1234' });
    assert.equal(res.reservacion.estado, 'check_in');
    assert.equal(res.habitacion.estado, 'ocupada');
    assert.equal(res.estancia.placasVehiculo, 'ABC1234');
    assert.deepEqual(llamadas.eventos, ['estancia.check_in']);
  });
  test('se puede llegar tarde (segundo día) mientras no sea el día de salida', async () => {
    const { d } = deps({ hoy: '2026-12-21' });
    await new RegistrarCheckIn(d).ejecutar('r1');
  });
  for (const estado of ['pendiente', 'cancelada', 'check_in', 'check_out']) {
    test(`RN-42 no se hace check-in si está ${estado}`, async () => {
      const { d, llamadas } = deps({ estado });
      await assert.rejects(new RegistrarCheckIn(d).ejecutar('r1'), { regla: 'RN-42' });
      assert.equal(llamadas.checkIn, 0);
    });
  }
  test('RN-44 no antes del día de entrada', async () => {
    const { d } = deps({ hoy: '2026-12-19' });
    await assert.rejects(new RegistrarCheckIn(d).ejecutar('r1'), { regla: 'RN-44' });
  });
  test('RN-44 no el día de salida o después', async () => {
    const { d } = deps({ hoy: '2026-12-22' });
    await assert.rejects(new RegistrarCheckIn(d).ejecutar('r1'), { regla: 'RN-44' });
  });
  for (const estadoHab of ['limpieza', 'ocupada', 'mantenimiento']) {
    test(`RN-45 no se entrega un cuarto en ${estadoHab}`, async () => {
      const { d, llamadas } = deps({ estadoHab });
      await assert.rejects(new RegistrarCheckIn(d).ejecutar('r1'), { regla: 'RN-45', status: 409 });
      assert.equal(llamadas.checkIn, 0);
    });
  }
});

describe('Check-out', () => {
  test('check_in + saldo en cero → check_out y evento para limpieza', async () => {
    const { d, llamadas } = deps({ estado: 'check_in', saldo: 0 });
    const res = await new RegistrarCheckOut(d).ejecutar('r1');
    assert.equal(res.reservacion.estado, 'check_out');
    assert.deepEqual(llamadas.eventos, ['estancia.check_out']);
  });
  test('RN-52 no se va debiendo dinero', async () => {
    const { d, llamadas } = deps({ estado: 'check_in', saldo: 250 });
    await assert.rejects(new RegistrarCheckOut(d).ejecutar('r1'), { regla: 'RN-52', message: /250\.00/ });
    assert.equal(llamadas.checkOut, 0);
  });
  test('RN-43 no se hace check-out sin check-in', async () => {
    const { d } = deps({ estado: 'confirmada' });
    await assert.rejects(new RegistrarCheckOut(d).ejecutar('r1'), { regla: 'RN-43' });
  });
});
