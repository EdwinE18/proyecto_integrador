// Prueba del ADAPTADOR sin base de datos: un pool falso registra lo que se le enviaría a PostgreSQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresReservacionRepository } from '../../src/modules/reservaciones/infrastructure/persistence/PostgresReservacionRepository.js';
import { Reservacion } from '../../src/modules/reservaciones/domain/entities/Reservacion.js';
import { RangoFechas } from '../../src/modules/reservaciones/domain/value-objects/RangoFechas.js';

function poolFalso(filas = [{ libre: true }]) {
  const consultas = [];
  return { consultas, query: async (sql, params) => { consultas.push({ sql, params }); return { rows: filas }; } };
}

test('guardar() manda las fechas como texto YYYY-MM-DD (no se recorren por zona horaria)', async () => {
  const fila = { id: 'x', codigo: 'C', hotel_id: 'h', huesped_id: 'g', habitacion_id: 'r',
    fecha_entrada: '2026-12-20', fecha_salida: '2026-12-22', num_adultos: 1, num_ninos: 0,
    precio_noche: '1100.00', estado: 'pendiente', canal: 'mostrador' };
  const pool = poolFalso([fila]);
  const r = new Reservacion({ hotelId: 'h', huespedId: 'g', habitacionId: 'r',
    entrada: '2026-12-20', salida: '2026-12-22', precioNoche: 1100 });
  const guardada = await new PostgresReservacionRepository(pool).guardar(r);
  const [, , , entrada, salida] = pool.consultas[0].params;
  assert.equal(entrada, '2026-12-20');
  assert.equal(salida, '2026-12-22');
  assert.equal(guardada.rango.entradaISO, '2026-12-20');
});

test('habitacionDisponible() busca en las fechas correctas', async () => {
  const pool = poolFalso();
  await new PostgresReservacionRepository(pool).habitacionDisponible('r', new RangoFechas('2026-12-20', '2026-12-22'));
  assert.deepEqual(pool.consultas[0].params, ['r', '2026-12-20', '2026-12-22']);
});

test('guardar() traduce el error de sobreventa de PostgreSQL (23P01) a HTTP 409', async () => {
  const pool = { query: async () => { throw Object.assign(new Error('exclusion'), { code: '23P01' }); } };
  const r = new Reservacion({ hotelId: 'h', huespedId: 'g', habitacionId: 'r',
    entrada: '2026-12-20', salida: '2026-12-22', precioNoche: 1100 });
  await assert.rejects(new PostgresReservacionRepository(pool).guardar(r), { status: 409, regla: 'RN-01' });
});
