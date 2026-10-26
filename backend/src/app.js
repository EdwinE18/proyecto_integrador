import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { container, hotelDeRecurso } from './shared/container.js';
import { validarUUID } from './shared/infrastructure/http/middlewares/validarUUID.js';
import { errorHandler } from './shared/infrastructure/http/middlewares/errorHandler.js';
import { autenticar, permitir, soloSuHotel } from './modules/usuarios/infrastructure/http/auth.middleware.js';
import { authRoutes, usuarioRoutes } from './modules/usuarios/infrastructure/http/auth.routes.js';
import { reservacionRoutes, agendaRoutes } from './modules/reservaciones/infrastructure/http/reservacion.routes.js';
import { pagoRoutes } from './modules/pagos/infrastructure/http/pago.routes.js';
import { estanciaRoutes } from './modules/estancias/infrastructure/http/estancia.routes.js';
import { huespedRoutes } from './modules/huespedes/infrastructure/http/huesped.routes.js';
import { hotelRoutes } from './modules/hoteles/infrastructure/http/hotel.routes.js';
import { habitacionesDeHotelRoutes, habitacionRoutes } from './modules/habitaciones/infrastructure/http/habitacion.routes.js';
import { exploradorRoutes } from './modules/explorador/infrastructure/http/explorador.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const conSesion = autenticar(container);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Página del explorador de la BD: http://localhost:3000 (pide iniciar sesión como admin)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Rutas públicas ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes(container, conSesion));

// ---------- De aquí para abajo TODO pide sesión (RN-71) ----------
app.use('/api', conSesion);

app.use('/api/usuarios', usuarioRoutes(container));

// Hoteles y habitaciones                                   RN-72 permiso   ·  RN-75 su hotel
app.use('/api/hoteles', permitir('habitaciones:ver'));
app.use('/api/hoteles/:hotelId', validarUUID('hotelId', 'El hotel no existe'), soloSuHotel((r) => r.params.hotelId));
app.get(['/api/hoteles/:hotelId/disponibilidad', '/api/hoteles/:hotelId/agenda'], permitir('reservaciones:gestionar'));
app.use('/api/hoteles', hotelRoutes(container));
app.use('/api/hoteles/:hotelId', habitacionesDeHotelRoutes(container), agendaRoutes(container));
app.use('/api/habitaciones/:id', validarUUID('id', 'La habitación no existe'), permitir('habitaciones:ver'),
  soloSuHotel((r) => hotelDeRecurso.deHabitacion(r.params.id)));
app.use('/api/habitaciones', habitacionRoutes(container));   // el caso de uso revisa limpieza vs. servicio

// Huéspedes (registro compartido entre los hoteles del sistema)
app.use('/api/huespedes', permitir('huespedes:gestionar'), huespedRoutes(container));

// Reservaciones, pagos y estancias
app.use('/api/reservaciones', permitir('reservaciones:gestionar'));
app.get('/api/reservaciones', (req, _res, next) => {   // si no se indica hotel, se usa el del usuario
  if (!req.query.hotelId && req.usuario.hotelId) req.query.hotelId = req.usuario.hotelId;
  next();
}, soloSuHotel((r) => r.query.hotelId));
app.post('/api/reservaciones', soloSuHotel((r) => r.body?.hotelId));
app.use('/api/reservaciones/:id', validarUUID(), soloSuHotel((r) => hotelDeRecurso.deReservacion(r.params.id)));
app.use('/api/reservaciones/:id/pagos', permitir('pagos:registrar'), pagoRoutes(container));
app.post(['/api/reservaciones/:id/check-in', '/api/reservaciones/:id/check-out'], permitir('estancias:gestionar'));
app.use('/api/reservaciones/:id', estanciaRoutes(container));
app.use('/api/reservaciones', reservacionRoutes(container));

// Explorador de la BD: solo administradores
app.use('/api/explorador', permitir('explorador:ver'), exploradorRoutes(container));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);
