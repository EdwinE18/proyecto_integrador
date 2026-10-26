import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cotizar } from '../../src/modules/reservaciones/domain/services/Tarifador.js';
import { RangoFechas } from '../../src/modules/reservaciones/domain/value-objects/RangoFechas.js';
import { Dinero } from '../../src/modules/pagos/domain/value-objects/Dinero.js';

const base = Dinero.dePesos(1100);
const navidad = { nombre: 'Navidad', inicio: '2026-12-20', fin: '2027-01-02', precio: Dinero.dePesos(1500) };
const precios = (c) => c.noches.map((n) => `${n.fecha}:${n.precio}`);

test('sin temporadas: todas las noches al precio base', () => {
  const c = cotizar({ rango: new RangoFechas('2026-11-10', '2026-11-13'), precioBase: base });
  assert.equal(c.noches.length, 3);
  assert.equal(c.total.toString(), '3300.00');
  assert.equal(c.promedioNoche.toString(), '1100.00');
});

test('estancia que cruza el inicio de la temporada', () => {
  const c = cotizar({ rango: new RangoFechas('2026-12-18', '2026-12-22'), precioBase: base, temporadas: [navidad] });
  assert.deepEqual(precios(c), ['2026-12-18:1100.00', '2026-12-19:1100.00', '2026-12-20:1500.00', '2026-12-21:1500.00']);
  assert.equal(c.total.toString(), '5200.00');
  assert.equal(c.promedioNoche.toString(), '1300.00');
});

test('el día en que TERMINA la temporada ya cobra precio base (fin no incluido)', () => {
  const c = cotizar({ rango: new RangoFechas('2027-01-01', '2027-01-03'), precioBase: base, temporadas: [navidad] });
  assert.deepEqual(precios(c), ['2027-01-01:1500.00', '2027-01-02:1100.00']);
});

test('cruza el cambio de año y varias temporadas', () => {
  const enero = { nombre: 'Enero', inicio: '2027-01-02', fin: '2027-01-10', precio: Dinero.dePesos(900) };
  const c = cotizar({ rango: new RangoFechas('2026-12-31', '2027-01-04'), precioBase: base, temporadas: [navidad, enero] });
  assert.deepEqual(c.noches.map((n) => n.temporada), ['Navidad', 'Navidad', 'Enero', 'Enero']);
  assert.equal(c.total.toString(), '4800.00');
});

test('promedio con centavos se redondea, pero el total es exacto', () => {
  const t = { nombre: 'X', inicio: '2026-05-01', fin: '2026-05-02', precio: Dinero.dePesos('1000.01') };
  const c = cotizar({ rango: new RangoFechas('2026-05-01', '2026-05-04'), precioBase: Dinero.dePesos(1000), temporadas: [t] });
  assert.equal(c.total.toString(), '3000.01');
  assert.equal(c.promedioNoche.toString(), '1000.00');
});
