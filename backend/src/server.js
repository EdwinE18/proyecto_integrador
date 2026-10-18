import { app } from './app.js';
import { config } from './shared/infrastructure/config/env.js';
app.listen(config.port, () => console.log(`🏨 PMS API en http://localhost:${config.port}`));
