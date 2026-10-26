import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos y los vuelve a cargar cuando cambian las dependencias.
 * const { datos, cargando, error, recargar } = useConsulta(() => pmsApi.hoteles(), []);
 * Si la función regresa null (por ejemplo, aún no hay hotel elegido), no consulta nada.
 */
export function useConsulta(consulta, deps) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const vigente = useRef(0);

  const cargar = useCallback(() => {
    const promesa = consulta();
    if (!promesa) { setEstado({ datos: null, cargando: false, error: null }); return; }
    const id = ++vigente.current;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    promesa.then(
      (datos) => id === vigente.current && setEstado({ datos, cargando: false, error: null }),
      (error) => id === vigente.current && setEstado((e) => ({ ...e, cargando: false, error })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { cargar(); }, [cargar]);
  return { ...estado, recargar: cargar };
}
