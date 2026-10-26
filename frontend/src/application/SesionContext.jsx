import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { pmsApi } from '../infrastructure/api/pmsApi.js';
import { configurarCliente } from '../infrastructure/api/cliente.js';
import { sesionStorage } from '../infrastructure/storage/sesionStorage.js';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(() => sesionStorage.leer());
  const [hotelId, setHotelId] = useState(null);
  const [hoteles, setHoteles] = useState([]);
  const [aviso, setAviso] = useState('');

  const cerrarSesion = useCallback((mensaje = '') => {
    sesionStorage.borrar(); configurarCliente({ token: null });
    setSesion(null); setHoteles([]); setHotelId(null); setAviso(mensaje);
  }, []);

  // El token se pasa al cliente HTTP antes de pintar (no en un efecto) para que la primera petición ya lo lleve
  configurarCliente({ token: sesion?.token ?? null, alExpirar: () => cerrarSesion('Tu sesión terminó. Vuelve a entrar.') });

  const iniciarSesion = useCallback(async (email, password) => {
    const s = await pmsApi.login(email, password);
    sesionStorage.guardar(s); configurarCliente({ token: s.token }); setAviso(''); setSesion(s);
  }, []);

  // Al entrar: cargar los hoteles que el usuario puede ver (RN-75) y elegir el primero
  useEffect(() => {
    if (!sesion) return;
    pmsApi.hoteles().then((lista) => {
      setHoteles(lista);
      setHotelId((actual) => actual ?? sesion.usuario.hotelId ?? lista[0]?.id ?? null);
    }).catch(() => {});
  }, [sesion]);

  const valor = useMemo(() => ({
    usuario: sesion?.usuario ?? null,
    iniciarSesion, cerrarSesion, aviso,
    /** RN-72: el backend manda la lista de permisos; aquí solo se consulta */
    puede: (permiso) => Boolean(sesion?.usuario?.permisos?.includes(permiso)),
    hoteles, hotelId, setHotelId,
    hotel: hoteles.find((h) => h.id === hotelId) ?? null,
    recargarHoteles: () => pmsApi.hoteles().then(setHoteles),
  }), [sesion, iniciarSesion, cerrarSesion, aviso, hoteles, hotelId]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);
