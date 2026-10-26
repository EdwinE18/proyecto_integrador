import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Huesped } from '../../src/modules/huespedes/domain/entities/Huesped.js';
import { BuscarHuespedes } from '../../src/modules/huespedes/application/use-cases/BuscarHuespedes.js';
import { ActualizarHuesped } from '../../src/modules/huespedes/application/use-cases/ActualizarHuesped.js';

const base = { nombre: 'ana', apellidos: 'martínez díaz', telefono: '961 123 4567' };

describe('Huesped', () => {
  test('normaliza nombre, apellidos, teléfono y documento', () => {
    const h = new Huesped({ nombre: '  maRÍA   josé ', apellidos: 'LÓPEZ  ñañez', telefono: '(961) 123-45 67',
                            email: ' Maria@Correo.COM ', tipoDocumento: 'INE', numDocumento: 'lopm 900101-mdf' });
    assert.equal(h.nombreCompleto, 'María José López Ñañez');
    assert.equal(h.telefono, '9611234567');
    assert.equal(h.email, 'maria@correo.com');
    assert.equal(h.numDocumento, 'LOPM900101MDF');
  });
  test('acepta teléfonos internacionales con +', () => {
    assert.equal(new Huesped({ ...base, telefono: '+49 151 2345 6789' }).telefono, '+4915123456789');
  });
  test('RN-31 nombre y apellidos obligatorios', () => {
    assert.throws(() => new Huesped({ ...base, nombre: '   ' }), { regla: 'RN-31' });
  });
  test('RN-32 necesita correo o teléfono', () => {
    assert.throws(() => new Huesped({ nombre: 'A', apellidos: 'B' }), { regla: 'RN-32' });
    new Huesped({ nombre: 'A', apellidos: 'B', email: 'a@b.mx' });
  });
  test('RN-32 rechaza correo o teléfono con formato inválido', () => {
    assert.throws(() => new Huesped({ ...base, email: 'ana@correo' }), { regla: 'RN-32' });
    assert.throws(() => new Huesped({ ...base, telefono: '12345' }), { regla: 'RN-32' });
  });
  test('RN-33 tipo y número de documento van juntos', () => {
    assert.throws(() => new Huesped({ ...base, numDocumento: 'ABC' }), { regla: 'RN-33' });
    assert.throws(() => new Huesped({ ...base, tipoDocumento: 'INE' }), { regla: 'RN-33' });
    assert.throws(() => new Huesped({ ...base, tipoDocumento: 'CURP', numDocumento: 'X' }), { regla: 'RN-33' });
  });
  test('conCambios vuelve a validar', () => {
    const h = new Huesped({ ...base, id: 'h1' });
    assert.equal(h.conCambios({ notas: 'Alérgica a nueces' }).notas, 'Alérgica a nueces');
    assert.equal(h.conCambios({ notas: 'x' }).id, 'h1');
    assert.throws(() => h.conCambios({ telefono: null }), { regla: 'RN-32' });
  });
});

describe('Casos de uso de huéspedes', () => {
  test('la búsqueda pide al menos 2 letras', async () => {
    const uc = new BuscarHuespedes({ huespedRepository: { buscar: async () => [] } });
    await assert.rejects(uc.ejecutar(' a '), { status: 400 });
    assert.deepEqual(await uc.ejecutar('an'), []);
  });
  test('actualizar un huésped inexistente → 404', async () => {
    const uc = new ActualizarHuesped({ huespedRepository: { buscarPorId: async () => null } });
    await assert.rejects(uc.ejecutar('x', {}), { status: 404 });
  });
});
