import { Huesped } from '../../domain/entities/Huesped.js';
export class RegistrarHuesped {
  constructor({ huespedRepository }) { this.repo = huespedRepository; }
  ejecutar(datos) { return this.repo.guardar(new Huesped(datos)); }   // RN-30 la revisa la BD (UNIQUE)
}
