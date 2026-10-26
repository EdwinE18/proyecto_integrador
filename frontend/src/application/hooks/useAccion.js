import { useState } from 'react';

/**
 * Ejecuta una acción (guardar, confirmar, cobrar…) y lleva su estado de carga y error.
 *   const { ok, valor } = await ejecutar(() => pmsApi.confirmar(id));
 * Nunca lanza: si falla, deja el error en `error` para mostrarlo con <Aviso>.
 */
export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const ejecutar = async (fn) => {
    setOcupado(true); setError(null);
    try { return { ok: true, valor: await fn() }; }
    catch (e) { setError(e); return { ok: false }; }
    finally { setOcupado(false); }
  };
  return { ocupado, error, setError, ejecutar };
}
