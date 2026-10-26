import { useState } from 'react';
import { useSesion } from '../../application/SesionContext.jsx';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { ROLES } from '../../domain/estados.js';
import { Aviso, Boton, Campo, Encabezado } from '../components/comunes.jsx';

export default function MiCuenta() {
  const { usuario } = useSesion();
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [listo, setListo] = useState(false);
  const accion = useAccion();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault(); setListo(false);
    if (f.nueva !== f.repetir) return accion.setError({ message: 'Las contraseñas nuevas no coinciden' });
    const { ok } = await accion.ejecutar(() => pmsApi.cambiarPassword(f.actual, f.nueva));
    if (ok) { setListo(true); setF({ actual: '', nueva: '', repetir: '' }); }
  };
  return (
    <>
      <Encabezado titulo="Mi cuenta" subtitulo={`${usuario.nombre} ${usuario.apellidos} · ${ROLES[usuario.rol]} · ${usuario.email}`} />
      <form className="tarjeta tarjeta-cuerpo formulario" style={{ maxWidth: 420 }} onSubmit={guardar}>
        <h2>Cambiar contraseña</h2>
        {listo && <Aviso tipo="ok">Contraseña actualizada.</Aviso>}
        <Aviso error={accion.error} />
        <Campo etiqueta="Contraseña actual"><input type="password" value={f.actual} onChange={cambiar('actual')} required autoComplete="current-password" /></Campo>
        <Campo etiqueta="Nueva contraseña" ayuda="8 o más caracteres, con letras y números"><input type="password" value={f.nueva} onChange={cambiar('nueva')} required autoComplete="new-password" /></Campo>
        <Campo etiqueta="Repite la nueva"><input type="password" value={f.repetir} onChange={cambiar('repetir')} required autoComplete="new-password" /></Campo>
        <div><Boton tipo="primario" cargando={accion.ocupado} type="submit">Guardar</Boton></div>
      </form>
    </>
  );
}
