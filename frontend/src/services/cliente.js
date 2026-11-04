// ADAPTADOR HTTP: único lugar del frontend que sabe que existe fetch y el token.
export class ApiError extends Error {
  constructor(status, mensaje, regla) { super(mensaje); this.status = status; this.regla = regla; }
}

let token = null;
let alExpirar = () => {};
export const configurarCliente = ({ token: t, alExpirar: fn }) => { token = t; if (fn) alExpirar = fn; };

export async function http(metodo, ruta, cuerpo) {
  let r;
  try {
    r = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. ¿Está corriendo el backend?');
  }
  if (r.status === 204) return null;
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && token) alExpirar();
    throw new ApiError(r.status, datos.error ?? `Error ${r.status}`, datos.regla);
  }
  return datos;
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
export const get = (ruta, query) => http('GET', query ? `${ruta}?${qs(query)}` : ruta);
export const post = (ruta, cuerpo) => http('POST', ruta, cuerpo ?? {});
export const patch = (ruta, cuerpo) => http('PATCH', ruta, cuerpo ?? {});
