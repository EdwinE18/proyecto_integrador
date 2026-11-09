import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Usuario } from '../../src/modules/usuarios/domain/entities/Usuario.js';
import { validarGestion, puedeGestionar } from '../../src/modules/usuarios/domain/politicaPersonal.js';
import { CrearUsuario } from '../../src/modules/usuarios/application/use-cases/CrearUsuario.js';
import { ActualizarUsuario } from '../../src/modules/usuarios/application/use-cases/ActualizarUsuario.js';
import { RestablecerPassword } from '../../src/modules/usuarios/application/use-cases/RestablecerPassword.js';
import { ConfiguracionHotel } from '../../src/modules/hoteles/domain/entities/ConfiguracionHotel.js';

const H1 = 'hotel-1', H2 = 'hotel-2';
const u = (id, rol, hotelId = H1) => new Usuario({ id, hotelId, nombre: 'N', apellidos: 'A', email: `${id}@x.mx`, rol });
const adminGeneral = u('ag', 'admin', null), adminH1 = u('a1', 'admin'), gerente = u('g1', 'gerente');
const recep = u('r1', 'recepcion'), limpia = u('l1', 'limpieza'), otroGerente = u('g2', 'gerente'), recepH2 = u('r2', 'recepcion', H2);

function repoFalso() {
  const datos = new Map([adminGeneral, adminH1, gerente, recep, limpia, otroGerente, recepH2].map((x) => [x.id, x]));
  return {
    datos, passwords: {},
    buscarPorId: async (id) => datos.get(id) ?? null,
    actualizar: async (x) => { datos.set(x.id, x); return x; },
    guardar: async (x) => { x.id = 'nuevo'; return x; },
    cambiarPassword: async function (id, h) { this.passwords[id] = h; },
  };
}
const hasher = { hashear: async (p) => `hash(${p})` };

describe('RN-75 / RN-76 quién administra a quién', () => {
  test('el admin general administra a todos', () => {
    for (const x of [adminH1, gerente, recep, recepH2]) assert.equal(puedeGestionar(adminGeneral, x), true);
  });
  test('el admin de un hotel administra a todo su hotel, pero no a otro', () => {
    assert.equal(puedeGestionar(adminH1, gerente), true);
    assert.throws(() => validarGestion(adminH1, recepH2), { regla: 'RN-75' });
  });
  test('el gerente administra recepción y limpieza de su hotel', () => {
    assert.equal(puedeGestionar(gerente, recep), true);
    assert.equal(puedeGestionar(gerente, limpia), true);
    assert.throws(() => validarGestion(gerente, otroGerente), { regla: 'RN-76' });
    assert.throws(() => validarGestion(gerente, adminH1), { regla: 'RN-76' });
    assert.throws(() => validarGestion(gerente, recepH2), { regla: 'RN-75' });
  });
});

describe('Crear, editar y restablecer', () => {
  test('el gerente crea recepcionistas en su hotel (aunque no lo indique)', async () => {
    const nuevo = await new CrearUsuario({ usuarioRepository: repoFalso(), passwordHasher: hasher })
      .ejecutar({ nombre: 'Rosa', apellidos: 'Pérez', email: 'rosa@x.mx', rol: 'recepcion', password: 'Demo1234' }, gerente);
    assert.equal(nuevo.hotelId, H1);
  });
  test('RN-76 el gerente NO crea administradores', async () => {
    await assert.rejects(new CrearUsuario({ usuarioRepository: repoFalso(), passwordHasher: hasher })
      .ejecutar({ nombre: 'X', apellidos: 'Y', email: 'x@x.mx', rol: 'admin', password: 'Demo1234' }, gerente), { regla: 'RN-76' });
  });
  test('el gerente desactiva a una recepcionista y le registra su chat de Telegram', async () => {
    const repo = repoFalso();
    const r = await new ActualizarUsuario({ usuarioRepository: repo }).ejecutar(gerente, 'r1', { activo: false, telegramChatId: '123456789' });
    assert.equal(r.activo, false); assert.equal(r.telegramChatId, '123456789');
  });
  test('RN-76 el gerente no puede ascender a alguien a gerente', async () => {
    await assert.rejects(new ActualizarUsuario({ usuarioRepository: repoFalso() }).ejecutar(gerente, 'r1', { rol: 'gerente' }), { regla: 'RN-76' });
  });
  test('RN-75 un admin de hotel no puede mover a alguien a otro hotel', async () => {
    await assert.rejects(new ActualizarUsuario({ usuarioRepository: repoFalso() }).ejecutar(adminH1, 'r1', { hotelId: H2 }), { regla: 'RN-75' });
  });
  test('RN-77 nadie se desactiva ni se cambia el rol a sí mismo', async () => {
    const caso = new ActualizarUsuario({ usuarioRepository: repoFalso() });
    await assert.rejects(caso.ejecutar(adminGeneral, 'ag', { activo: false }), { regla: 'RN-77' });
    await assert.rejects(caso.ejecutar(adminH1, 'a1', { rol: 'recepcion' }), { regla: 'RN-77' });
    const yo = await caso.ejecutar(adminH1, 'a1', { nombre: 'Nuevo' });          // su nombre sí
    assert.equal(yo.nombre, 'Nuevo');
  });
  test('RN-86 el chat de Telegram debe ser un número', async () => {
    await assert.rejects(new ActualizarUsuario({ usuarioRepository: repoFalso() }).ejecutar(gerente, 'r1', { telegramChatId: '@rosa' }), { regla: 'RN-86' });
  });
  test('restablecer contraseña: valida RN-73 y no aplica a uno mismo', async () => {
    const repo = repoFalso();
    const caso = new RestablecerPassword({ usuarioRepository: repo, passwordHasher: hasher });
    await caso.ejecutar(gerente, 'l1', { password: 'Nueva2026' });
    assert.equal(repo.passwords.l1, 'hash(Nueva2026)');
    await assert.rejects(caso.ejecutar(gerente, 'l1', { password: 'corta' }), { regla: 'RN-73' });
    await assert.rejects(caso.ejecutar(gerente, 'g1', { password: 'Nueva2026' }), { regla: 'RN-77' });
    await assert.rejects(caso.ejecutar(gerente, 'a1', { password: 'Nueva2026' }), { regla: 'RN-76' });
  });
});

describe('Configuración del hotel (RN-79)', () => {
  const base = { telefono: '961 123 4567', email: 'Hola@Arcos.MX', horaCheckIn: '15:00', horaCheckOut: '12:00', telegramChatId: '-1001234567890' };
  test('limpia teléfono y correo', () => {
    const c = new ConfiguracionHotel(base);
    assert.equal(c.telefono, '9611234567'); assert.equal(c.email, 'hola@arcos.mx');
  });
  for (const [caso, extra] of [['teléfono corto', { telefono: '12345' }], ['hora mal escrita', { horaCheckIn: '3pm' }],
    ['salida después de la entrada', { horaCheckOut: '16:00' }], ['chat de Telegram con letras', { telegramChatId: 'grupo' }]])
    test(`rechaza: ${caso}`, () => assert.throws(() => new ConfiguracionHotel({ ...base, ...extra }), { regla: 'RN-79' }));
});
