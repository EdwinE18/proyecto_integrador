import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SesionProvider, useSesion } from '../application/SesionContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Tablero from './pages/Tablero.jsx';
import NuevaReservacion from './pages/NuevaReservacion.jsx';
import Reservaciones from './pages/Reservaciones.jsx';
import DetalleReservacion from './pages/DetalleReservacion.jsx';
import Habitaciones from './pages/Habitaciones.jsx';
import Huespedes from './pages/Huespedes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import MiCuenta from './pages/MiCuenta.jsx';

/** Solo muestra la página si el rol tiene el permiso. El backend vuelve a revisarlo (RN-72). */
function Con({ permiso, children }) {
  const { puede } = useSesion();
  return puede(permiso) ? children : <Navigate to="/habitaciones" replace />;
}

function Rutas() {
  const { usuario, puede } = useSesion();
  if (!usuario) return <Login />;
  const inicio = puede('reservaciones:gestionar') ? <Tablero /> : <Navigate to="/habitaciones" replace />;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={inicio} />
        <Route path="nueva" element={<Con permiso="reservaciones:gestionar"><NuevaReservacion /></Con>} />
        <Route path="reservaciones" element={<Con permiso="reservaciones:gestionar"><Reservaciones /></Con>} />
        <Route path="reservaciones/:id" element={<Con permiso="reservaciones:gestionar"><DetalleReservacion /></Con>} />
        <Route path="habitaciones" element={<Habitaciones />} />
        <Route path="huespedes" element={<Con permiso="huespedes:gestionar"><Huespedes /></Con>} />
        <Route path="usuarios" element={<Con permiso="usuarios:gestionar"><Usuarios /></Con>} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <SesionProvider><BrowserRouter><Rutas /></BrowserRouter></SesionProvider>;
}
