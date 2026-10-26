import bcrypt from 'bcrypt';
import { PasswordHasher } from '../../domain/ports/PasswordHasher.js';

// bcrypt es lento a propósito (10 rondas ≈ 70 ms): adivinar contraseñas por fuerza bruta sale muy caro.
export class BcryptPasswordHasher extends PasswordHasher {
  constructor(rondas = 10) { super(); this.rondas = rondas; }
  hashear(password) { return bcrypt.hash(password, this.rondas); }
  async verificar(password, hash) {
    try { return await bcrypt.compare(password, hash); } catch { return false; }
  }
}
