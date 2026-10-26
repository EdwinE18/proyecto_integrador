import { useState } from 'react';
import { useSesion } from '../../application/SesionContext.jsx';
import { useConsulta } from '../../application/hooks/useConsulta.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { ROLES } from '../../domain/estados.js';
import { fechaHora } from '../../domain/formato.js';
import { Aviso, Boton, Campo, Cargando, Chip, Encabezado, Modal } from '../components/comunes.jsx';

export default function Usuarios() {
  const { hoteles } = useSesion();
  const usuarios = useConsulta(() => pmsApi.usuarios(), []);
  const [nuevo, setNuevo] = useState(false);
  const nombreHotel = (id) => hoteles.find((h) => h.id === id)?.nombre ?? 'Todos';

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Personal con acceso al sistema">
        <Boton tipo="primario" onClick={() => setNuevo(true)}>+ Nuevo usuario</Boton>
      </Encabezado>
      <Aviso error={usuarios.error} />
      <section className="tarjeta">
        {!usuarios.datos ? <Cargando /> : (
          <div className="tabla-caja"><table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Hotel</th><th>Último acceso</th><th>Estado</th></tr></thead>
            <tbody>{usuarios.datos.map((u) => (
              <tr key={u.id} style={{ cursor: 'default' }}>
                <td><b>{u.nombre} {u.apellidos}</b></td><td>{u.email}</td><td>{ROLES[u.rol]}</td><td>{nombreHotel(u.hotelId)}</td>
                <td className="suave">{u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : 'Nunca'}</td>
                <td>{u.activo ? <Chip tono="verde">Activo</Chip> : <Chip tono="gris">Desactivado</Chip>}</td>
              </tr>))}
            </tbody>
          </table></div>)}
      </section>
      {nuevo && <ModalUsuario hoteles={hoteles} alCerrar={() => setNuevo(false)} alTerminar={() => { setNuevo(false); usuarios.recargar(); }} />}
    </>
  );
}

function ModalUsuario({ hoteles, alCerrar, alTerminar }) {
  const [u, setU] = useState({ nombre: '', apellidos: '', email: '', rol: 'recepcion', hotelId: hoteles[0]?.id ?? '', password: '' });
  const accion = useAccion();
  const cambiar = (k) => (e) => setU({ ...u, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    const { ok } = await accion.ejecutar(() => pmsApi.crearUsuario({ ...u, hotelId: u.hotelId || null }));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo="Nuevo usuario" alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={accion.ocupado} form="form-usuario" type="submit">Crear</Boton></>}>
      <form id="form-usuario" className="formulario" onSubmit={guardar}>
        <Aviso error={accion.error} />
        <div className="fila">
          <Campo etiqueta="Nombre"><input value={u.nombre} onChange={cambiar('nombre')} required /></Campo>
          <Campo etiqueta="Apellidos"><input value={u.apellidos} onChange={cambiar('apellidos')} required /></Campo>
        </div>
        <Campo etiqueta="Correo"><input type="email" value={u.email} onChange={cambiar('email')} required /></Campo>
        <div className="fila">
          <Campo etiqueta="Rol"><select value={u.rol} onChange={cambiar('rol')}>{Object.entries(ROLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>
          <Campo etiqueta="Hotel"><select value={u.hotelId} onChange={cambiar('hotelId')}>
            {u.rol === 'admin' && <option value="">Todos (admin general)</option>}
            {hoteles.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select></Campo>
        </div>
        <Campo etiqueta="Contraseña inicial" ayuda="8 o más caracteres, con letras y números (RN-73)">
          <input type="password" value={u.password} onChange={cambiar('password')} required autoComplete="new-password" />
        </Campo>
      </form>
    </Modal>
  );
}
