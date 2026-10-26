import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Reservacion } from '../../src/modules/reservaciones/domain/entities/Reservacion.js';
import { CrearReservacion } from '../../src/modules/reservaciones/application/use-cases/CrearReservacion.js';

const datos = { hotelId: 'h1', huespedId: 'g', habitacionId: 'r', entrada: '2026-12-01', salida: '2026-12-04',
                numAdultos: 2, numNinos: 0, precioNoche: 1000 };

// Habitación doble en buen estado (se cambia por prueba)
const habitacion = { id: 'r', hotelId: 'h1', numero: '201', estado: 'disponible', activo: true,
                     capacidadAdultos: 2, capacidadNinos: 1 };

// Arma el caso de uso con adaptadores falsos: no necesita base de datos
function crearCaso({ hab = habitacion, libre = true, hoy = '2026-11-15' } = {}) {
  const llamadas = { guardar: 0, eventos: [] };
  const uc = new CrearReservacion({
    reservacionRepository: {
      habitacionDisponible: async () => libre,
      guardar: async (r) => { llamadas.guardar++; r.id = 'nuevo'; r.codigo = 'ABC12345'; return r; },
    },
    habitacionReader: { obtenerParaReservar: async () => hab },
    reloj: { hoy: () => hoy },
    eventPublisher: { publicar: async (tipo) => { llamadas.eventos.push(tipo); } },
  });
  return { uc, llamadas };
}

describe('Entidad Reservacion', () => {
  test('RN-06 calcula noches y total', () => {
    const r = new Reservacion(datos);
    assert.equal(r.rango.noches, 3);
    assert.equal(r.total, 3000);
  });
  test('RN-04 rechaza salida antes de entrada', () => {
    assert.throws(() => new Reservacion({ ...datos, salida: '2026-11-30' }), { regla: 'RN-04' });
  });
  test('RN-05 rechaza cero adultos', () => {
    assert.throws(() => new Reservacion({ ...datos, numAdultos: 0 }), { regla: 'RN-05' });
  });
});

describe('Caso de uso CrearReservacion', () => {
  test('crea la reservación y publica el evento cuando todo es válido', async () => {
    const { uc, llamadas } = crearCaso();
    const r = await uc.ejecutar(datos);
    assert.equal(r.total, 3000);
    assert.equal(llamadas.guardar, 1);
    assert.deepEqual(llamadas.eventos, ['reservacion.creada']);
  });

  test('RN-01 rechaza habitación ocupada (409)', async () => {
    const { uc, llamadas } = crearCaso({ libre: false });
    await assert.rejects(uc.ejecutar(datos), { status: 409, regla: 'RN-01' });
    assert.equal(llamadas.guardar, 0);
  });

  test('RN-08 rechaza habitación inexistente (404)', async () => {
    const { uc } = crearCaso({ hab: null });
    await assert.rejects(uc.ejecutar(datos), { status: 404 });
  });

  test('RN-08 rechaza habitación de otro hotel', async () => {
    const { uc } = crearCaso({ hab: { ...habitacion, hotelId: 'otro' } });
    await assert.rejects(uc.ejecutar(datos), { regla: 'RN-08' });
  });

  test('RN-11 rechaza más adultos de los que caben', async () => {
    const { uc, llamadas } = crearCaso();
    await assert.rejects(uc.ejecutar({ ...datos, numAdultos: 3 }), { status: 400, regla: 'RN-11' });
    assert.equal(llamadas.guardar, 0);
  });

  test('RN-11 rechaza más niños de los que caben', async () => {
    const { uc } = crearCaso();
    await assert.rejects(uc.ejecutar({ ...datos, numNinos: 2 }), { regla: 'RN-11' });
  });

  test('RN-11 acepta la capacidad exacta', async () => {
    const { uc } = crearCaso();
    await uc.ejecutar({ ...datos, numAdultos: 2, numNinos: 1 });
  });

  test('RN-13 rechaza habitación en mantenimiento (409)', async () => {
    const { uc } = crearCaso({ hab: { ...habitacion, estado: 'mantenimiento' } });
    await assert.rejects(uc.ejecutar(datos), { status: 409, regla: 'RN-13' });
  });

  test('RN-13 rechaza habitación dada de baja', async () => {
    const { uc } = crearCaso({ hab: { ...habitacion, activo: false } });
    await assert.rejects(uc.ejecutar(datos), { regla: 'RN-13' });
  });

  test('RN-13 sí permite reservar una habitación que está en limpieza', async () => {
    const { uc } = crearCaso({ hab: { ...habitacion, estado: 'limpieza' } });
    await uc.ejecutar(datos);
  });

  test('RN-14 rechaza fecha de entrada en el pasado', async () => {
    const { uc } = crearCaso({ hoy: '2026-12-02' });
    await assert.rejects(uc.ejecutar(datos), { regla: 'RN-14' });
  });

  test('RN-14 permite reservar para hoy mismo', async () => {
    const { uc } = crearCaso({ hoy: '2026-12-01' });
    await uc.ejecutar(datos);
  });
});
