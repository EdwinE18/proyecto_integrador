import express from 'express';
import cors from 'cors';
import { container } from './shared/container.js';
import { reservacionRoutes } from './modules/reservaciones/infrastructure/http/reservacion.routes.js';
import { errorHandler } from './shared/infrastructure/http/middlewares/errorHandler.js';

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/reservaciones', reservacionRoutes(container));

app.use(errorHandler);
