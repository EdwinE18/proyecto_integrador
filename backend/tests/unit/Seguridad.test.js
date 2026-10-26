import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { puede, permisosDe, permisoParaEstado } from '../../src/modules/usuarios/domain/permisos.js';
import { Usuario } from '../../src/modules/usuarios/domain/entities/Usuario.js';
import { IniciarSesion } from '../../src/modules/usuarios/application/use-cases/IniciarSesion.js';
import { ObtenerSesion } from '../../src/modules/usuarios/application/use-cases/ObtenerSesion.js';
import { MemoriaContadorIntentos } from '../../src/modules/usuarios/infrastructure/security/MemoriaContadorIntentos.js';
import { JwtTokenService } from '../../src/modules/usuarios/infrastructure/security/JwtTokenService.js';
import { BcryptPasswordHasher } from '../../src/modules/usuarios/infrastructure/security/BcryptPasswordHasher.js';
import { permitir, soloSuHotel } from '../../src/modules/usuarios/infrastructure/http/auth.middleware.js';
import { CambiarEstadoHabitacion } from '../../src/modules/habitaciones/application/use-cases/CambiarEstadoHabitacion.js';
import { Habitacion } from '../../src/modules/habitaciones/domain/entities/Habitacion.js';

const H1 = '11111111-1111-1111-1111-111111111111';
const H2 = '22222222-2222-2222-2222-222222222222';
const usuario = (rol, hotelId = H1, activo = true) =>
  new Usuario({ id: 'u-' + rol, hotelId, nombre: 'N', apellidos: 'A', email: `${rol}@x.mx`, rol, activo });

describe('RN-72 permisos por rol', () => {
  const tabla = [
    ['reservaciones:gestionar', { admin: 1, gerente: 1, recepcion: 1, limpieza: 0 }],
    ['pagos:registrar',         { admin: 1, gerente: 1, recepcion: 1, limpieza: 0 }],
    ['habitaciones:limpieza',   { admin: 1, gerente: 1, recepcion: 1, limpieza: 1 }],
    ['habitaciones:servicio',   { admin: 1, gerente: 1, recepcion: 1, limpieza: 0 }],
    ['tarifas:gestionar',       { admin: 1, gerente: 1, recepcion: 0, limpieza: 0 }],
    ['usuarios:gestionar',      { admin: 1, gerente: 0, recepcion: 0, limpieza: 0 }],
  ];
  for (const [permiso, roles] of tabla)
    for (const [rol, si] of Object.entries(roles))
      test(`${rol} ${si ? 'sí' : 'NO'} puede ${permiso}`, () => assert.equal(puede(rol, permiso), Boolean(si)));
  test('permiso inexistente o rol desconocido → no', () => {
    assert.equal(puede('admin', 'inventado'), false);
    assert.equal(puede(undefined, 'habitaciones:ver'), false);
  });
  test('limpieza solo recibe permisos de habitaciones', () => {
    assert.deepEqual(permisosDe('limpieza'), ['habitaciones:ver', 'habitaciones:limpieza']);
  });
  test('qué permiso pide cada cambio de estado', () => {
    assert.equal(permisoParaEstado('limpieza', 'disponible'), 'habitaciones:limpieza');
    assert.equal(permisoParaEstado('disponible', 'mantenimiento'), 'habitaciones:servicio');
    assert.equal(permisoParaEstado('mantenimiento', 'disponible'), 'habitaciones:servicio');
  });
});

describe('Usuario', () => {
  test('RN-75 quien no es admin debe tener hotel', () => {
    assert.throws(() => usuario('recepcion', null), { regla: 'RN-75' });
    assert.equal(usuario('admin', null).esAdminGeneral, true);
  });
  test('RN-75 solo ve su hotel; el admin general ve todos', () => {
    assert.equal(usuario('recepcion').puedeVerHotel(H1), true);
    assert.equal(usuario('recepcion').puedeVerHotel(H2), false);
    assert.equal(usuario('admin', null).puedeVerHotel(H2), true);
    assert.equal(usuario('admin', H1).puedeVerHotel(H2), false);   // admin de UN hotel
  });
  for (const mala of ['corta1', 'sinnumeros', '12345678', '', undefined])
    test(`RN-73 rechaza contraseña ${JSON.stringify(mala)}`, () => assert.throws(() => Usuario.validarPassword(mala), { regla: 'RN-73' }));
  test('RN-73 acepta Demo1234', () => Usuario.validarPassword('Demo1234'));
});

describe('MemoriaContadorIntentos (RN-74)', () => {
  test('bloquea al 5.º fallo y se libera a los 15 minutos', () => {
    let t = 0;
    const c = new MemoriaContadorIntentos({ maximo: 5, ventanaMs: 15 * 60_000, ahora: () => t });
    for (let i = 0; i < 4; i++) c.registrarFallo('a');
    assert.equal(c.bloqueo('a'), null);
    c.registrarFallo('a');
    assert.equal(c.bloqueo('a'), 15 * 60_000);
    t += 15 * 60_000 + 1;
    assert.equal(c.bloqueo('a'), null);
  });
  test('un inicio de sesión exitoso reinicia la cuenta', () => {
    const c = new MemoriaContadorIntentos({ maximo: 2 });
    c.registrarFallo('a'); c.limpiar('a'); c.registrarFallo('a');
    assert.equal(c.bloqueo('a'), null);
  });
});

describe('IniciarSesion', () => {
  const hasher = new BcryptPasswordHasher(4);   // 4 rondas: rápido para pruebas
  const tokens = new JwtTokenService('secreto-de-pruebas-123456');
  async function caso({ activo = true, intentos = new MemoriaContadorIntentos() } = {}) {
    const hash = await hasher.hashear('Demo1234');
    const accesos = [];
    const repo = {
      buscarPorEmailConPassword: async (email) => email === 'ana@x.mx'
        ? { usuario: new Usuario({ id: 'u1', hotelId: H1, nombre: 'Ana', apellidos: 'P', email, rol: 'recepcion', activo }), passwordHash: hash }
        : null,
      registrarAcceso: async (id) => accesos.push(id),
    };
    return { uc: new IniciarSesion({ usuarioRepository: repo, passwordHasher: hasher, tokenService: tokens, contadorIntentos: intentos }), accesos };
  }

  test('credenciales correctas → token y registra el acceso', async () => {
    const { uc, accesos } = await caso();
    const r = await uc.ejecutar({ email: '  ANA@x.mx ', password: 'Demo1234' });
    assert.equal(tokens.verificar(r.token).sub, 'u1');
    assert.deepEqual(accesos, ['u1']);
  });
  test('RN-71 el mismo mensaje si falla el correo o la contraseña', async () => {
    const { uc } = await caso();
    const e1 = await uc.ejecutar({ email: 'nadie@x.mx', password: 'Demo1234' }).catch((e) => e);
    const e2 = await uc.ejecutar({ email: 'ana@x.mx', password: 'Mala1234' }).catch((e) => e);
    assert.equal(e1.message, e2.message);
    assert.equal(e1.status, 401);
  });
  test('RN-71 usuario desactivado no entra (403)', async () => {
    const { uc } = await caso({ activo: false });
    await assert.rejects(uc.ejecutar({ email: 'ana@x.mx', password: 'Demo1234' }), { status: 403 });
  });
  test('RN-74 al 6.º intento ni siquiera revisa la contraseña (429)', async () => {
    const { uc } = await caso({ intentos: new MemoriaContadorIntentos({ maximo: 5 }) });
    for (let i = 0; i < 5; i++) await uc.ejecutar({ email: 'ana@x.mx', password: 'Mala1234' }).catch(() => {});
    await assert.rejects(uc.ejecutar({ email: 'ana@x.mx', password: 'Demo1234' }), { status: 429, regla: 'RN-74' });
  });
});

describe('ObtenerSesion y JWT', () => {
  const tokens = new JwtTokenService('secreto-de-pruebas-123456');
  const repo = (u) => ({ buscarPorId: async () => u });
  test('token válido → usuario', async () => {
    const u = usuario('recepcion');
    const { token } = tokens.firmar(u);
    assert.equal((await new ObtenerSesion({ usuarioRepository: repo(u), tokenService: tokens }).ejecutar(token)).id, u.id);
  });
  test('token alterado, de otro secreto o expirado → 401', async () => {
    const u = usuario('recepcion');
    const uc = new ObtenerSesion({ usuarioRepository: repo(u), tokenService: tokens });
    const bueno = tokens.firmar(u).token;
    const malos = [
      bueno.slice(0, -2) + (bueno.endsWith('A') ? 'BB' : 'AA'),
      jwt.sign({ sub: u.id }, 'otro-secreto-cualquiera-123'),
      jwt.sign({ sub: u.id, exp: Math.floor(Date.now() / 1000) - 10 }, 'secreto-de-pruebas-123456'),
      jwt.sign({ sub: u.id }, '', { algorithm: 'none' }),
      undefined,
    ];
    for (const t of malos) await assert.rejects(uc.ejecutar(t), { status: 401 });
  });
  test('si desactivan al usuario, su token deja de servir al instante', async () => {
    const u = usuario('recepcion', H1, false);
    const uc = new ObtenerSesion({ usuarioRepository: repo(u), tokenService: tokens });
    await assert.rejects(uc.ejecutar(tokens.firmar(u).token), { status: 401 });
  });
  test('no arranca con un JWT_SECRET vacío o corto', () => {
    assert.throws(() => new JwtTokenService(''));
    assert.throws(() => new JwtTokenService('corto'));
  });
});

describe('Middlewares', () => {
  const correr = (mw, req) => new Promise((ok) => mw(req, {}, (err) => ok(err ?? null)));
  test('permitir: limpieza no puede cobrar (403)', async () => {
    const err = await correr(permitir('pagos:registrar'), { usuario: usuario('limpieza') });
    assert.equal(err.status, 403);
    assert.equal(await correr(permitir('pagos:registrar'), { usuario: usuario('recepcion') }), null);
  });
  test('soloSuHotel: recepción de un hotel no entra a otro (403)', async () => {
    const err = await correr(soloSuHotel(() => H2), { usuario: usuario('recepcion', H1) });
    assert.equal(err.regla, 'RN-75');
    assert.equal(await correr(soloSuHotel(() => H1), { usuario: usuario('recepcion', H1) }), null);
    assert.equal(await correr(soloSuHotel(() => H2), { usuario: usuario('admin', null) }), null);
  });
});

describe('RN-72 en el cambio de estado de habitación', () => {
  const uc = (estado) => new CambiarEstadoHabitacion({
    habitacionRepository: { buscarPorId: async () => new Habitacion({ id: 'h', numero: '201', estado }),
                            guardarEstado: async () => {}, reservacionesProximas: async () => [] },
    reloj: { hoy: () => '2026-11-01' }, eventPublisher: { publicar: async () => {} },
  });
  test('limpieza sí marca un cuarto como limpio', async () => {
    await uc('limpieza').ejecutar('h', { estado: 'disponible' }, usuario('limpieza'));
  });
  test('limpieza NO manda un cuarto a mantenimiento', async () => {
    await assert.rejects(uc('disponible').ejecutar('h', { estado: 'mantenimiento', comentario: 'x' }, usuario('limpieza')),
      { status: 403, regla: 'RN-72' });
  });
  test('limpieza NO regresa un cuarto de mantenimiento', async () => {
    await assert.rejects(uc('mantenimiento').ejecutar('h', { estado: 'disponible' }, usuario('limpieza')), { status: 403 });
  });
});
