import pg from 'pg';
import { config } from '../config/env.js';

// Las columnas DATE se regresan como texto "2026-10-06" para que no se recorran por zona horaria
pg.types.setTypeParser(1082, (valor) => valor);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
