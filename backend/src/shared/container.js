// COMPOSICIÓN: el único lugar donde se "enchufan" los adaptadores a los puertos.
import { pool } from './infrastructure/database/pool.js';
import { PostgresOutboxPublisher } from './infrastructure/events/PostgresOutboxPublisher.js';
import { RelojSistema } from './infrastructure/time/RelojSistema.js';

// Reservaciones
import { PostgresReservacionRepository } from '../modules/reservaciones/infrastructure/persistence/PostgresReservacionRepository.js';
import { PostgresHabitacionReader } from '../modules/reservaciones/infrastructure/persistence/PostgresHabitacionReader.js';
import { PostgresTarifaReader } from '../modules/reservaciones/infrastructure/persistence/PostgresTarifaReader.js';
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

// Huéspedes
import { PostgresHuespedRepository } from '../modules/huespedes/infrastructure/persistence/PostgresHuespedRepository.js';
import { RegistrarHuesped } from '../modules/huespedes/application/use-cases/RegistrarHuesped.js';
import { ActualizarHuesped } from '../modules/huespedes/application/use-cases/ActualizarHuesped.js';
import { BuscarHuespedes } from '../modules/huespedes/application/use-cases/BuscarHuespedes.js';
import { ObtenerHuesped } from '../modules/huespedes/application/use-cases/ObtenerHuesped.js';

// Hoteles y habitaciones
import { PostgresHotelRepository } from '../modules/hoteles/infrastructure/persistence/PostgresHotelRepository.js';
import { ListarHoteles } from '../modules/hoteles/application/use-cases/ListarHoteles.js';
import { PostgresHabitacionRepository } from '../modules/habitaciones/infrastructure/persistence/PostgresHabitacionRepository.js';
import { ListarHabitaciones } from '../modules/habitaciones/application/use-cases/ListarHabitaciones.js';
import { BuscarDisponibilidad } from '../modules/habitaciones/application/use-cases/BuscarDisponibilidad.js';
import { CambiarEstadoHabitacion } from '../modules/habitaciones/application/use-cases/CambiarEstadoHabitacion.js';

// Explorador de la BD
import { PostgresEsquemaRepository } from '../modules/explorador/infrastructure/persistence/PostgresEsquemaRepository.js';
import { ListarTablas } from '../modules/explorador/application/use-cases/ListarTablas.js';
import { VerTabla } from '../modules/explorador/application/use-cases/VerTabla.js';

// Adaptadores (infraestructura)
const reloj = new RelojSistema('America/Mexico_City');
const eventPublisher = new PostgresOutboxPublisher(pool);
const reservacionRepository = new PostgresReservacionRepository(pool);
const habitacionReader = new PostgresHabitacionReader(pool);
const tarifaReader = new PostgresTarifaReader(pool);
const huespedRepository = new PostgresHuespedRepository(pool);
const hotelRepository = new PostgresHotelRepository(pool);
const habitacionRepository = new PostgresHabitacionRepository(pool);
const pagoRepository = new PostgresPagoRepository(pool);
const estanciaRepository = new PostgresEstanciaRepository(pool);
const esquemaRepository = new PostgresEsquemaRepository(pool);

// Casos de uso (aplicación)
export const container = {
  crearReservacion: new CrearReservacion({ reservacionRepository, habitacionReader, tarifaReader, reloj, eventPublisher }),
  listarReservaciones: new ListarReservaciones({ reservacionRepository }),
  obtenerReservacion: new ObtenerReservacion({ reservacionRepository }),
  confirmarReservacion: new ConfirmarReservacion({ reservacionRepository, eventPublisher }),
  cancelarReservacion: new CancelarReservacion({ reservacionRepository, eventPublisher }),

  registrarPago: new RegistrarPago({ pagoRepository, eventPublisher }),
  consultarCuenta: new ConsultarCuenta({ pagoRepository }),

  registrarCheckIn: new RegistrarCheckIn({ reservacionRepository, habitacionReader, estanciaRepository, reloj, eventPublisher }),
  registrarCheckOut: new RegistrarCheckOut({ reservacionRepository, habitacionReader, pagoRepository, estanciaRepository, eventPublisher }),

  registrarHuesped: new RegistrarHuesped({ huespedRepository }),
  actualizarHuesped: new ActualizarHuesped({ huespedRepository }),
  buscarHuespedes: new BuscarHuespedes({ huespedRepository }),
  obtenerHuesped: new ObtenerHuesped({ huespedRepository }),

  listarHoteles: new ListarHoteles({ hotelRepository }),
  listarHabitaciones: new ListarHabitaciones({ habitacionRepository }),
  buscarDisponibilidad: new BuscarDisponibilidad({ habitacionRepository, tarifaReader, reloj }),
  cambiarEstadoHabitacion: new CambiarEstadoHabitacion({ habitacionRepository, reloj, eventPublisher }),

  listarTablas: new ListarTablas({ esquemaRepository }),
  verTabla: new VerTabla({ esquemaRepository }),
};
