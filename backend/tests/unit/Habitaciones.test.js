import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Habitacion } from '../../src/modules/habitaciones/domain/entities/Habitacion.js';
import { CambiarEstadoHabitacion } from '../../src/modules/habitaciones/application/use-cases/CambiarEstadoHabitacion.js';
import { BuscarDisponibilidad } from '../../src/modules/habitaciones/application/use-cases/BuscarDisponibilidad.js';
import { Dinero } from '../../src/modules/pagos/domain/value-objects/Dinero.js';

const hab = (estado) => new Habitacion({ id: 'h1', numero: '201', estado, tipoId: 't1', precioBase: Dinero.dePesos(1100) });

describe('RN-24 cambios de estado de una habitación', () => {
  const validos = [['limpieza', 'disponible'], ['disponible', 'mantenimiento'], ['mantenimiento', 'disponible'],
                   ['disponible', 'limpieza'], ['mantenimiento', 'limpieza'], ['fuera_servicio', 'disponible']];
  for (const [de, a] of validos) test(`${de} → ${a} ✔`, () => { const h = hab(de); h.cambiarEstado(a); assert.equal(h.estado, a); });

  const invalidos = [['disponible', 'ocupada'], ['ocupada', 'limpieza'], ['ocupada', 'disponible'],
                     ['limpieza', 'fuera_servicio'], ['disponible', 'disponible'], ['disponible', 'rota']];
  for (const [de, a] of invalidos) test(`${de} → ${a} ✘`, () => assert.throws(() => hab(de).cambiarEstado(a), { regla: 'RN-24' }));
});

function casoEstado(estadoActual, afectadas = []) {
  const llamadas = { guardado: null, eventos: [] };
  return {
    llamadas,
    uc: new CambiarEstadoHabitacion({
      habitacionRepository: {
        buscarPorId: async () => hab(estadoActual),
        guardarEstado: async (h, nota) => { llamadas.guardado = { estado: h.estado, nota }; },
        reservacionesProximas: async () => afectadas,
      },
      reloj: { hoy: () => '2026-11-01' },
      eventPublisher: { publicar: async (tipo, _id, p) => llamadas.eventos.push({ tipo, p }) },
    }),
  };
}

describe('Caso de uso CambiarEstadoHabitacion', () => {
  test('limpieza terminada: limpieza → disponible', async () => {
    const { uc, llamadas } = casoEstado('limpieza');
    await uc.ejecutar('h1', { estado: 'disponible' });
    assert.deepEqual(llamadas.guardado, { estado: 'disponible', nota: null });
    assert.deepEqual(llamadas.eventos[0].p, { numero: '201', de: 'limpieza', a: 'disponible', reservacionesAfectadas: 0 });
  });
  test('RN-25 mandar a mantenimiento exige comentario', async () => {
    const { uc, llamadas } = casoEstado('disponible');
    await assert.rejects(uc.ejecutar('h1', { estado: 'mantenimiento', comentario: '  ' }), { regla: 'RN-25' });
    assert.equal(llamadas.guardado, null);
  });
  test('al mandar a mantenimiento avisa las reservaciones que hay que reubicar', async () => {
    const { uc } = casoEstado('disponible', [{ codigo: 'ABC' }]);
    const r = await uc.ejecutar('h1', { estado: 'mantenimiento', comentario: 'Fuga en el baño' });
    assert.equal(r.reservacionesAfectadas.length, 1);
  });
});

describe('Caso de uso BuscarDisponibilidad', () => {
  const uc = (libres = [hab('disponible')], temporadas = []) => new BuscarDisponibilidad({
    habitacionRepository: { disponibles: async () => libres },
    tarifaReader: { temporadas: async () => temporadas },
    reloj: { hoy: () => '2026-11-01' },
  });
  test('cotiza cada cuarto libre (RN-61)', async () => {
    const navidad = { nombre: 'Navidad', inicio: '2026-12-20', fin: '2027-01-03', precio: Dinero.dePesos(1500) };
    const r = await uc(undefined, [navidad]).ejecutar('hotel', { entrada: '2026-12-19', salida: '2026-12-21', adultos: '2' });
    assert.equal(r.noches, 2);
    assert.equal(r.habitaciones[0].cotizacion.total.toString(), '2600.00');
  });
  test('RN-14 no busca en fechas pasadas', async () => {
    await assert.rejects(uc().ejecutar('hotel', { entrada: '2026-10-01', salida: '2026-10-03' }), { regla: 'RN-14' });
  });
  test('RN-04 exige fechas', async () => {
    await assert.rejects(uc().ejecutar('hotel', {}), { regla: 'RN-04' });
  });
  test('RN-05 al menos un adulto', async () => {
    await assert.rejects(uc().ejecutar('hotel', { entrada: '2026-12-01', salida: '2026-12-02', adultos: 0 }), { regla: 'RN-05' });
  });
});
