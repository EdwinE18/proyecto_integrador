const ZONA = 'America/Mexico_City';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const dinero = (n) => (n === null || n === undefined ? '—' : pesos.format(n));

// Las fechas llegan como 'YYYY-MM-DD'. Se leen a mediodía UTC para que ninguna zona horaria las recorra.
const comoFecha = (iso) => new Date(`${iso}T12:00:00Z`);
export const fechaCorta = (iso) => iso ? comoFecha(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—';
export const fechaLarga = (iso) => iso ? comoFecha(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '—';
export const fechaHora = (ts) => ts ? new Date(ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA }) : '—';

/** Hoy en Chiapas, 'YYYY-MM-DD' */
export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
export const sumarDias = (iso, dias) => new Date(comoFecha(iso).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
export const noches = (entrada, salida) => Math.round((comoFecha(salida) - comoFecha(entrada)) / 86_400_000);
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
