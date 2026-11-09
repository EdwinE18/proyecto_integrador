import { app } from './app.js';
import { config } from './shared/infrastructure/config/env.js';
if (config.jwtSecret === 'cambia_esto_por_algo_largo')
  console.warn('⚠️  JWT_SECRET sigue siendo el de ejemplo. Cámbialo en backend/.env (genera uno con: openssl rand -hex 32)');

app.listen(config.port, () => console.log(`🏨 PMS API en http://localhost:${config.port}`));
