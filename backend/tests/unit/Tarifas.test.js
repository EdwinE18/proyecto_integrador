import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Temporada } from '../../src/modules/tarifas/domain/entities/Temporada.js';
import { CrearTemporada } from '../../src/modules/tarifas/application/use-cases/CrearTemporada.js';
import { EliminarTemporada } from '../../src/modules/tarifas/application/use-cases/EliminarTemporada.js';
import { CambiarPrecioBase } from '../../src/modules/tarifas/application/use-cases/CambiarPrecioBase.js';

const H1 = 'hotel-1', H2 = 'hotel-2';
const reloj = { hoy: () => '2026-11-09' };
const datos = (extra = {}) => ({ tipoId: 'tipo-1', nombre: 'Navidad 2026', fechaInicio: '2026-12-20', fechaFin: '2027-01-03', precioNoche: '1500', ...extra });

/** Repositorio en memoria: el tipo-1 es del hotel 1 */
function repoFalso() {
  const temporadas = new Map();
  return {
    temporadas, precios: {},
    hotelDelTipo: async (id) => (id === 'tipo-1' ? H1 : null),
    guardarTemporada: async (t) => { t.id = `t${temporadas.size + 1}`; temporadas.set(t.id, t); return t; },
    buscarTemporada: async (id) => (temporadas.has(id) ? { temporada: temporadas.get(id), hotelId: H1 } : null),
    eliminarTemporada: async (id) => temporadas.delete(id),
    actualizarPrecioBase: async function (id, d) { this.precios[id] = d.pesos; },
  };
}

describe('Temporada (RN-62)', () => {
  test('acepta una temporada válida y limpia el nombre', () => {
    const t = new Temporada(datos({ nombre: '  Navidad   2026 ' }));
    assert.equal(t.nombre, 'Navidad 2026');
    assert.equal(t.precioNoche.centavos, 150000);
  });
  for (const [caso, extra] of [
    ['nombre muy corto', { nombre: 'X' }],
    ['fecha inválida', { fechaInicio: '2026-02-30' }],
    ['fin antes del inicio', { fechaFin: '2026-12-01' }],
    ['fin igual al inicio', { fechaFin: '2026-12-20' }],
    ['precio cero', { precioNoche: 0 }],
    ['precio negativo', { precioNoche: '-10' }],
    ['precio con 3 decimales', { precioNoche: '10.555' }],
    ['precio exagerado', { precioNoche: '250000' }],
  ]) test(`rechaza: ${caso}`, () => assert.throws(() => new Temporada(datos(extra)), { regla: 'RN-62' }));
});

describe('Casos de uso de tarifas', () => {
  test('crea una temporada del hotel', async () => {
    const repo = repoFalso();
    const t = await new CrearTemporada({ tarifaRepository: repo, reloj }).ejecutar(H1, datos());
    assert.equal(repo.temporadas.size, 1); assert.equal(t.id, 't1');
  });
  test('RN-75 no se crean temporadas para tipos de otro hotel', async () => {
    await assert.rejects(new CrearTemporada({ tarifaRepository: repoFalso(), reloj }).ejecutar(H2, datos()), { regla: 'RN-75', status: 404 });
  });
  test('RN-63 no se crean temporadas que ya terminaron', async () => {
    await assert.rejects(new CrearTemporada({ tarifaRepository: repoFalso(), reloj })
      .ejecutar(H1, datos({ fechaInicio: '2026-10-01', fechaFin: '2026-11-09' })), { regla: 'RN-63' });
  });
  test('RN-63 se borra una temporada futura, pero no una que ya empezó', async () => {
    const repo = repoFalso();
    const crear = new CrearTemporada({ tarifaRepository: repo, reloj });
    const eliminar = new EliminarTemporada({ tarifaRepository: repo, reloj });
    const futura = await crear.ejecutar(H1, datos());
    const enCurso = await crear.ejecutar(H1, datos({ nombre: 'Puente', fechaInicio: '2026-11-08', fechaFin: '2026-11-12' }));
    await eliminar.ejecutar(H1, futura.id);
    assert.equal(repo.temporadas.has(futura.id), false);
    await assert.rejects(eliminar.ejecutar(H1, enCurso.id), { regla: 'RN-63', status: 409 });
    await assert.rejects(eliminar.ejecutar(H2, enCurso.id), { status: 404 });
  });
  test('cambia el precio base solo con un precio válido y del hotel correcto', async () => {
    const repo = repoFalso();
    const caso = new CambiarPrecioBase({ tarifaRepository: repo });
    await caso.ejecutar(H1, 'tipo-1', { precioBase: '1,250.50' });
    assert.equal(repo.precios['tipo-1'], 1250.5);
    await assert.rejects(caso.ejecutar(H1, 'tipo-1', { precioBase: 'mil' }), { regla: 'RN-62' });
    await assert.rejects(caso.ejecutar(H2, 'tipo-1', { precioBase: 900 }), { regla: 'RN-75' });
  });
});
