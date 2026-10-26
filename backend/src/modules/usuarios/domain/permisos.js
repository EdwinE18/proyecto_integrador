// RN-72: qué puede hacer cada rol. Es la ÚNICA fuente de verdad de permisos:
// el backend la usa para autorizar y el frontend la recibe al iniciar sesión.
export const ROLES = ['admin', 'gerente', 'recepcion', 'limpieza'];

const PERMISOS = {
  'reservaciones:gestionar': ['admin', 'gerente', 'recepcion'],   // crear, confirmar, cancelar, consultar
  'estancias:gestionar':     ['admin', 'gerente', 'recepcion'],   // check-in y check-out
  'pagos:registrar':         ['admin', 'gerente', 'recepcion'],   // cobrar y ver estado de cuenta
  'huespedes:gestionar':     ['admin', 'gerente', 'recepcion'],
  'habitaciones:ver':        ['admin', 'gerente', 'recepcion', 'limpieza'],
  'habitaciones:limpieza':   ['admin', 'gerente', 'recepcion', 'limpieza'], // limpieza ⇄ disponible
  'habitaciones:servicio':   ['admin', 'gerente', 'recepcion'],   // mantenimiento / fuera de servicio
  'tarifas:gestionar':       ['admin', 'gerente'],
  'usuarios:gestionar':      ['admin'],
  'explorador:ver':          ['admin'],
};

export const puede = (rol, permiso) => (PERMISOS[permiso] ?? []).includes(rol);
export const permisosDe = (rol) => Object.keys(PERMISOS).filter((p) => puede(rol, p));

/** Qué permiso pide un cambio de estado de habitación */
export const permisoParaEstado = (de, a) =>
  [de, a].some((e) => ['mantenimiento', 'fuera_servicio'].includes(e)) ? 'habitaciones:servicio' : 'habitaciones:limpieza';
