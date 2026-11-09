import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { ROLES } from '../utils/estados.js';

// Cada opción del menú aparece solo si el rol tiene el permiso (RN-72)
const MENU = [
  { a: '/',              ico: '🏠', texto: 'Tablero',            permiso: 'reservaciones:gestionar' },
  { a: '/nueva',         ico: '➕', texto: 'Nueva reservación',  permiso: 'reservaciones:gestionar' },
  { a: '/reservaciones', ico: '📅', texto: 'Reservaciones',      permiso: 'reservaciones:gestionar' },
  { a: '/habitaciones',  ico: '🛏️', texto: 'Habitaciones',       permiso: 'habitaciones:ver' },
  { a: '/huespedes',     ico: '👤', texto: 'Huéspedes',          permiso: 'huespedes:gestionar' },
  // Administración: admin y gerente
  { a: '/reportes',      ico: '📊', texto: 'Reportes',           permiso: 'reportes:ver', grupo: 'Administración' },
  { a: '/configuracion', ico: '🏷️', texto: 'Hotel y tarifas',    permiso: 'tarifas:gestionar', grupo: 'Administración' },
  { a: '/usuarios',      ico: '🔑', texto: 'Personal',           permiso: 'usuarios:gestionar', grupo: 'Administración' },
  { a: '/base-de-datos', ico: '🗄️', texto: 'Base de datos',      permiso: 'explorador:ver', grupo: 'Administración' },
];

export function AppLayout() {
  const { usuario, puede, hoteles, hotelId, setHotelId, hotel, cerrarSesion } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  const cerrarMenu = () => setAbierto(false);

  return (
    <div className="app">
      <div className="barra-movil">
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú">☰</button>
        <b>{hotel?.nombre ?? 'PMS'}</b>
      </div>
      {abierto && <div className="velo" onClick={cerrarMenu} />}
      <aside className={`lateral ${abierto ? 'abierto' : ''}`} onClick={(e) => e.target.closest('a') && cerrarMenu()}>
        <div className="marca"><span>🏨</span><div>PMS Hotelero<small>Boutique y posadas</small></div></div>
        {hoteles.length > 1 ? (
          <select value={hotelId ?? ''} onChange={(e) => setHotelId(e.target.value)} aria-label="Hotel">
            {hoteles.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        ) : hotel && <div className="marca" style={{ fontWeight: 600, fontSize: 13.5 }}>📍 {hotel.nombre}</div>}
        <nav>
          {MENU.filter((m) => puede(m.permiso)).map((m, i, lista) => (
            <div key={m.a} style={{ display: 'contents' }}>
              {m.grupo && m.grupo !== lista[i - 1]?.grupo && <span className="grupo-menu">{m.grupo}</span>}
              <NavLink to={m.a} end={m.a === '/'}><span className="ico">{m.ico}</span>{m.texto}</NavLink>
            </div>
          ))}
        </nav>
        <div className="usuario-lateral">
          <b>{usuario.nombre} {usuario.apellidos}</b>
          {ROLES[usuario.rol]}{!usuario.hotelId && ' · todos los hoteles'}
          <div className="acciones">
            <NavLink to="/cuenta">Mi cuenta</NavLink>
            <button onClick={() => cerrarSesion()}>Salir</button>
          </div>
        </div>
      </aside>
      <main className="contenido" key={pathname}>
        {hotelId ? <Outlet /> : <div className="cargando">Cargando hoteles…</div>}
      </main>
    </div>
  );
}
