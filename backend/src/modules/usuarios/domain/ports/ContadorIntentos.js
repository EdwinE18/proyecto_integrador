// RN-74: lleva la cuenta de intentos fallidos de inicio de sesión
export class ContadorIntentos {
  /** @returns {number|null} milisegundos que faltan de bloqueo, o null si no está bloqueado */
  bloqueo(clave) { throw new Error('No implementado'); }
  registrarFallo(clave) { throw new Error('No implementado'); }
  limpiar(clave) { throw new Error('No implementado'); }
}
