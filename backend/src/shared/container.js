// COMPOSICIÓN: el único lugar donde se "enchufan" los adaptadores a los puertos.
import { pool } from './infrastructure/database/pool.js';
import { PostgresOutboxPublisher } from './infrastructure/events/PostgresOutboxPublisher.js';
import { RelojSistema } from './infrastructure/time/RelojSistema.js';

// Reservaciones
import { PostgresReservacionRepository } from '../modules/reservaciones/infrastructure/persistence/PostgresReservacionRepository.js';
import { PostgresHabitacionReader } from '../modules/reservaciones/infrastructure/persistence/PostgresHabitacionReader.js';
import { CrearReservacion } from '../modules/reservaciones/application/use-cases/CrearReservacion.js';
import { ListarReservaciones } from '../modules/reservaciones/application/use-cases/ListarReservaciones.js';
import { ObtenerReservacion } from '../modules/reservaciones/application/use-cases/ObtenerReservacion.js';
import { ConfirmarReservacion } from '../modules/reservaciones/application/use-cases/ConfirmarReservacion.js';
import { CancelarReservacion } from '../modules/reservaciones/application/use-cases/CancelarReservacion.js';

// Pagos
import { PostgresPagoRepository } from '../modules/pagos/infrastructure/persistence/PostgresPagoRepository.js';
import { RegistrarPago } from '../modules/pagos/application/use-cases/RegistrarPago.js';
import { ConsultarCuenta } from '../modules/pagos/application/use-cases/ConsultarCuenta.js';

// Estancias
import { PostgresEstanciaRepository } from '../modules/estancias/infrastructure/persistence/PostgresEstanciaRepository.js';
import { RegistrarCheckIn } from '../modules/estancias/application/use-cases/RegistrarCheckIn.js';
import { RegistrarCheckOut } from '../modules/estancias/application/use-cases/RegistrarCheckOut.js';

// Explorador de la BD
import { PostgresEsquemaRepository } from '../modules/explorador/infrastructure/persistence/PostgresEsquemaRepository.js';
import { ListarTablas } from '../modules/explorador/application/use-cases/ListarTablas.js';
import { VerTabla } from '../modules/explorador/application/use-cases/VerTabla.js';

// Adaptadores (infraestructura)
const reloj = new RelojSistema('America/Mexico_City');
const eventPublisher = new PostgresOutboxPublisher(pool);
const reservacionRepository = new PostgresReservacionRepository(pool);
const habitacionReader = new PostgresHabitacionReader(pool);
const pagoRepository = new PostgresPagoRepository(pool);
const estanciaRepository = new PostgresEstanciaRepository(pool);
const esquemaRepository = new PostgresEsquemaRepository(pool);

// Casos de uso (aplicación)
export const container = {
  crearReservacion: new CrearReservacion({ reservacionRepository, habitacionReader, reloj, eventPublisher }),
  listarReservaciones: new ListarReservaciones({ reservacionRepository }),
  obtenerReservacion: new ObtenerReservacion({ reservacionRepository }),
  confirmarReservacion: new ConfirmarReservacion({ reservacionRepository, eventPublisher }),
  cancelarReservacion: new CancelarReservacion({ reservacionRepository, eventPublisher }),

  registrarPago: new RegistrarPago({ pagoRepository, eventPublisher }),
  consultarCuenta: new ConsultarCuenta({ pagoRepository }),

  registrarCheckIn: new RegistrarCheckIn({ reservacionRepository, habitacionReader, estanciaRepository, reloj, eventPublisher }),
  registrarCheckOut: new RegistrarCheckOut({ reservacionRepository, habitacionReader, pagoRepository, estanciaRepository, eventPublisher }),

  listarTablas: new ListarTablas({ esquemaRepository }),
  verTabla: new VerTabla({ esquemaRepository }),
};
