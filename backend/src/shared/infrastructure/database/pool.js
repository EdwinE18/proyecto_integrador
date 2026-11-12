import pg from 'pg';
import { config } from '../config/env.js';

// Las columnas DATE se regresan como texto "2026-10-06" para que no se recorran por zona horaria
pg.types.setTypeParser(1082, (valor) => valor);

// ssl: true verifica el certificado del servidor. Para RDS, el certificado de Amazon se
// agrega con NODE_EXTRA_CA_CERTS (lo configura deploy/aws/instalar.sh).
export const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.dbSsl ? true : undefined });
