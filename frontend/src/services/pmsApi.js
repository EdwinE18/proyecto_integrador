// Todas las rutas del backend en un solo lugar (ver la tabla "API" del README).
import { get, post, patch, del } from './cliente.js';

export const pmsApi = {
  // Sesión
  login: (email, password) => post('/auth/login', { email, password }),
  yo: () => get('/auth/yo'),
  cambiarPassword: (actual, nueva) => post('/auth/password', { actual, nueva }),

  // Hoteles y habitaciones
  hoteles: () => get('/hoteles'),
  habitaciones: (hotelId) => get(`/hoteles/${hotelId}/habitaciones`),
  disponibilidad: (hotelId, filtros) => get(`/hoteles/${hotelId}/disponibilidad`, filtros),
  agenda: (hotelId, filtros) => get(`/hoteles/${hotelId}/agenda`, filtros),
  cambiarEstadoHabitacion: (id, estado, comentario) => patch(`/habitaciones/${id}/estado`, { estado, comentario }),

  // Huéspedes
  buscarHuespedes: (q) => get('/huespedes', { q }),
  registrarHuesped: (datos) => post('/huespedes', datos),
  actualizarHuesped: (id, datos) => patch(`/huespedes/${id}`, datos),

  // Reservaciones
  crearReservacion: (datos) => post('/reservaciones', datos),
  detalleReservacion: (id) => get(`/reservaciones/${id}/detalle`),
  confirmar: (id) => patch(`/reservaciones/${id}/confirmar`),
  cancelar: (id, motivo) => patch(`/reservaciones/${id}/cancelar`, { motivo }),
  checkIn: (id, datos) => post(`/reservaciones/${id}/check-in`, datos),
  checkOut: (id) => post(`/reservaciones/${id}/check-out`),

  // Pagos
  cuenta: (id) => get(`/reservaciones/${id}/pagos`),
  registrarPago: (id, pago) => post(`/reservaciones/${id}/pagos`, pago),

  // Usuarios (admin y gerente)
  usuarios: () => get('/usuarios'),
  crearUsuario: (datos) => post('/usuarios', datos),
  actualizarUsuario: (id, datos) => patch(`/usuarios/${id}`, datos),
  restablecerPassword: (id, password) => post(`/usuarios/${id}/password`, { password }),

  // Administración del hotel (admin y gerente)
  configurarHotel: (hotelId, datos) => patch(`/hoteles/${hotelId}`, datos),
  tarifas: (hotelId) => get(`/hoteles/${hotelId}/tarifas`),
  cambiarPrecioBase: (hotelId, tipoId, precioBase) => patch(`/hoteles/${hotelId}/tarifas/tipos/${tipoId}`, { precioBase }),
  crearTemporada: (hotelId, datos) => post(`/hoteles/${hotelId}/tarifas/temporadas`, datos),
  eliminarTemporada: (hotelId, id) => del(`/hoteles/${hotelId}/tarifas/temporadas/${id}`),
  reporte: (hotelId, periodo) => get(`/hoteles/${hotelId}/reportes`, periodo),

  // Explorador de la base de datos (solo admin)
  tablas: () => get('/explorador/tablas'),
  tabla: (nombre, pagina) => get(`/explorador/tablas/${nombre}`, pagina),
};
