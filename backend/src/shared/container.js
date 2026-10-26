// COMPOSICIÓN: el único lugar donde se "enchufan" los adaptadores a los puertos.
import { pool } from './infrastructure/database/pool.js';
import { PostgresOutboxPublisher } from './infrastructure/events/PostgresOutboxPublisher.js';
import { RelojSistema } from './infrastructure/time/RelojSistema.js';
import { PostgresHabitacionReader } from '../modules/reservaciones/infrastructure/persistence/PostgresHabitacionReader.js';
import { PostgresReservacionRepository } from '../modules/reservaciones/infrastructure/persistence/PostgresReservacionRepository.js';
import { CrearReservacion } from '../modules/reservaciones/application/use-cases/CrearReservacion.js';
import { ListarReservaciones } from '../modules/reservaciones/application/use-cases/ListarReservaciones.js';
import { ObtenerReservacion } from '../modules/reservaciones/application/use-cases/ObtenerReservacion.js';
import { ConfirmarReservacion } from '../modules/reservaciones/application/use-cases/ConfirmarReservacion.js';
import { CancelarReservacion } from '../modules/reservaciones/application/use-cases/CancelarReservacion.js';
import { PostgresEsquemaRepository } from '../modules/explorador/infrastructure/persistence/PostgresEsquemaRepository.js';
import { ListarTablas } from '../modules/explorador/application/use-cases/ListarTablas.js';
import { VerTabla } from '../modules/explorador/application/use-cases/VerTabla.js';

const reservacionRepository = new PostgresReservacionRepository(pool);
const eventPublisher = new PostgresOutboxPublisher(pool);
const habitacionReader = new PostgresHabitacionReader(pool);
const reloj = new RelojSistema('America/Mexico_City');
const esquemaRepository = new PostgresEsquemaRepository(pool);

export const container = {
  crearReservacion: new CrearReservacion({ reservacionRepository, habitacionReader, reloj, eventPublisher }),
  listarReservaciones: new ListarReservaciones({ reservacionRepository }),
  obtenerReservacion: new ObtenerReservacion({ reservacionRepository }),
  confirmarReservacion: new ConfirmarReservacion({ reservacionRepository, eventPublisher }),
  cancelarReservacion: new CancelarReservacion({ reservacionRepository, eventPublisher }),
  listarTablas: new ListarTablas({ esquemaRepository }),
  verTabla: new VerTabla({ esquemaRepository }),
};
