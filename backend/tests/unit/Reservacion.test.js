import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reservacion } from '../../src/modules/reservaciones/domain/entities/Reservacion.js';
import { CrearReservacion } from '../../src/modules/reservaciones/application/use-cases/CrearReservacion.js';

const datos = { hotelId: 'h', huespedId: 'g', habitacionId: 'r', entrada: '2026-12-01', salida: '2026-12-04', precioNoche: 1000 };

test('calcula noches y total', () => {
  const r = new Reservacion(datos);
  assert.equal(r.rango.noches, 3);
  assert.equal(r.total, 3000);
});

test('rechaza salida antes de entrada', () => {
  assert.throws(() => new Reservacion({ ...datos, salida: '2026-11-30' }));
});

test('caso de uso rechaza habitación ocupada (con repositorio falso, sin BD)', async () => {
  const repoFalso = { habitacionDisponible: async () => false };
  const uc = new CrearReservacion({ reservacionRepository: repoFalso, eventPublisher: {} });
  await assert.rejects(uc.ejecutar(datos), { status: 409 });
});
