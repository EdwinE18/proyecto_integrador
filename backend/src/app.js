import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { container } from './shared/container.js';
import { reservacionRoutes } from './modules/reservaciones/infrastructure/http/reservacion.routes.js';
import { pagoRoutes } from './modules/pagos/infrastructure/http/pago.routes.js';
import { estanciaRoutes } from './modules/estancias/infrastructure/http/estancia.routes.js';
import { validarUUID } from './shared/infrastructure/http/middlewares/validarUUID.js';
import { exploradorRoutes } from './modules/explorador/infrastructure/http/explorador.routes.js';
import { errorHandler } from './shared/infrastructure/http/middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
app.use(cors());
app.use(express.json());

// Página para ver la base de datos: http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/reservaciones/:id/pagos', validarUUID(), pagoRoutes(container));
app.use('/api/reservaciones/:id', validarUUID(), estanciaRoutes(container));   // /check-in, /check-out
app.use('/api/reservaciones', reservacionRoutes(container));
app.use('/api/explorador', exploradorRoutes(container));

app.use(errorHandler);
