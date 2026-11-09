import { useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { useConsulta } from '../hooks/useConsulta.js';
import { useAccion } from '../hooks/useAccion.js';
import { pmsApi } from '../services/pmsApi.js';
import { ROLES } from '../utils/estados.js';
import { fechaHora } from '../utils/formato.js';
import { Aviso, Boton, Campo, Cargando, Chip, Encabezado, Modal } from '../components/comunes.jsx';

/** RN-76: el gerente solo da de alta recepción y limpieza; el admin, cualquier rol */
const rolesQuePuedeAsignar = (yo) => (yo.rol === 'gerente' ? ['recepcion', 'limpieza'] : Object.keys(ROLES));

export default function Usuarios() {
  const { usuario: yo, hoteles } = useSesion();
  const usuarios = useConsulta(() => pmsApi.usuarios(), []);
  const [modal, setModal] = useState(null);           // { tipo: 'nuevo' | 'editar' | 'password', u? }
  const nombreHotel = (id) => hoteles.find((h) => h.id === id)?.nombre ?? 'Todos';
  const cerrar = () => setModal(null);
  const terminar = () => { setModal(null); usuarios.recargar(); };

  return (
    <>
      <Encabezado titulo="Personal" subtitulo={yo.rol === 'gerente' ? 'Recepción y limpieza de tu hotel (RN-76)' : 'Usuarios con acceso al sistema'}>
        <Boton tipo="primario" onClick={() => setModal({ tipo: 'nuevo' })}>+ Nuevo usuario</Boton>
      </Encabezado>
      <Aviso error={usuarios.error} />
      <section className="tarjeta">
        {!usuarios.datos ? <Cargando /> : (
          <div className="tabla-caja"><table>
            <thead><tr><th>Nombre</th><th>Rol</th><th>Hotel</th><th>Telegram</th><th>Último acceso</th><th>Estado</th><th /></tr></thead>
            <tbody>{usuarios.datos.map((u) => (
              <tr key={u.id} style={{ cursor: 'default' }}>
                <td><b>{u.nombre} {u.apellidos}</b>{u.id === yo.id && <span className="tenue"> (tú)</span>}
                  <div className="suave" style={{ fontSize: 12.5 }}>{u.email}</div></td>
                <td>{ROLES[u.rol]}</td><td>{nombreHotel(u.hotelId)}</td>
                <td>{u.telegramChatId ? <Chip tono="azul">Vinculado</Chip> : <span className="tenue">—</span>}</td>
                <td className="suave">{u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : 'Nunca'}</td>
                <td>{u.activo ? <Chip tono="verde">Activo</Chip> : <Chip tono="gris">Desactivado</Chip>}</td>
                <td className="derecha">
                  {u.editable && <div className="botones" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                    <Boton chico onClick={() => setModal({ tipo: 'editar', u })}>Editar</Boton>
                    <Boton chico onClick={() => setModal({ tipo: 'password', u })}>Contraseña</Boton>
                  </div>}
                </td>
              </tr>))}
            </tbody>
          </table></div>)}
      </section>
      <p className="tenue" style={{ fontSize: 12.5 }}>
        Para usar el asistente de Telegram, cada persona le escribe <span className="mono">/miid</span> al bot y aquí se guarda ese número en “Editar”.
      </p>
      {modal?.tipo === 'nuevo' && <ModalUsuario yo={yo} hoteles={hoteles} alCerrar={cerrar} alTerminar={terminar} />}
      {modal?.tipo === 'editar' && <ModalUsuario yo={yo} hoteles={hoteles} existente={modal.u} alCerrar={cerrar} alTerminar={terminar} />}
      {modal?.tipo === 'password' && <ModalPassword u={modal.u} alCerrar={cerrar} alTerminar={terminar} />}
    </>
  );
}

function ModalUsuario({ yo, hoteles, existente, alCerrar, alTerminar }) {
  const roles = rolesQuePuedeAsignar(yo);
  const misHoteles = yo.hotelId ? hoteles.filter((h) => h.id === yo.hotelId) : hoteles;
  const [u, setU] = useState(existente
    ? { nombre: existente.nombre, apellidos: existente.apellidos, rol: existente.rol, hotelId: existente.hotelId ?? '',
        activo: existente.activo, telegramChatId: existente.telegramChatId ?? '' }
    : { nombre: '', apellidos: '', email: '', rol: roles.includes('recepcion') ? 'recepcion' : roles[0], hotelId: yo.hotelId ?? hoteles[0]?.id ?? '', password: '', telegramChatId: '' });
  const accion = useAccion();
  const cambiar = (k) => (e) => setU({ ...u, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    const datos = { ...u, hotelId: u.hotelId || null, telegramChatId: u.telegramChatId || null };
    const { ok } = await accion.ejecutar(() => (existente ? pmsApi.actualizarUsuario(existente.id, datos) : pmsApi.crearUsuario(datos)));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo={existente ? `Editar · ${existente.email}` : 'Nuevo usuario'} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={accion.ocupado} form="form-usuario" type="submit">{existente ? 'Guardar' : 'Crear'}</Boton></>}>
      <form id="form-usuario" className="formulario" onSubmit={guardar}>
        <Aviso error={accion.error} />
        <div className="fila">
          <Campo etiqueta="Nombre"><input value={u.nombre} onChange={cambiar('nombre')} required /></Campo>
          <Campo etiqueta="Apellidos"><input value={u.apellidos} onChange={cambiar('apellidos')} required /></Campo>
        </div>
        {!existente && <Campo etiqueta="Correo"><input type="email" value={u.email} onChange={cambiar('email')} required /></Campo>}
        <div className="fila">
          <Campo etiqueta="Rol"><select value={u.rol} onChange={cambiar('rol')}>{roles.map((v) => <option key={v} value={v}>{ROLES[v]}</option>)}</select></Campo>
          <Campo etiqueta="Hotel"><select value={u.hotelId} onChange={cambiar('hotelId')} disabled={Boolean(yo.hotelId)}>
            {u.rol === 'admin' && !yo.hotelId && <option value="">Todos (admin general)</option>}
            {misHoteles.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select></Campo>
        </div>
        <Campo etiqueta="Chat de Telegram (opcional)" ayuda="Número que da el bot con /miid. Activa el asistente para esta persona (RN-86).">
          <input value={u.telegramChatId} onChange={cambiar('telegramChatId')} inputMode="numeric" placeholder="123456789" />
        </Campo>
        {existente
          ? <label className="check"><input type="checkbox" checked={u.activo} onChange={cambiar('activo')} /> Puede entrar al sistema</label>
          : <Campo etiqueta="Contraseña inicial" ayuda="8 o más caracteres, con letras y números (RN-73)">
              <input type="password" value={u.password} onChange={cambiar('password')} required autoComplete="new-password" />
            </Campo>}
      </form>
    </Modal>
  );
}

function ModalPassword({ u, alCerrar, alTerminar }) {
  const [password, setPassword] = useState('');
  const accion = useAccion();
  const guardar = async (e) => {
    e.preventDefault();
    const { ok } = await accion.ejecutar(() => pmsApi.restablecerPassword(u.id, password));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo={`Nueva contraseña · ${u.nombre} ${u.apellidos}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={accion.ocupado} form="form-pass" type="submit">Guardar</Boton></>}>
      <form id="form-pass" className="formulario" onSubmit={guardar}>
        <Aviso error={accion.error} />
        <Aviso>Dásela a la persona en privado; puede cambiarla después en “Mi cuenta”.</Aviso>
        <Campo etiqueta="Contraseña nueva" ayuda="8 o más caracteres, con letras y números (RN-73)">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus autoComplete="new-password" />
        </Campo>
      </form>
    </Modal>
  );
}
