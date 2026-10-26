export class AuthError extends Error {
  constructor(msg, regla, status = 401) { super(msg); this.name = 'AuthError'; this.regla = regla; this.status = status; }
}
