import { useEffect, useState } from 'react';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { Aviso, Boton, Campo, Encabezado, Modal, Vacio } from '../components/comunes.jsx';
import { FormHuesped } from '../components/FormHuesped.jsx';

export default function Huespedes() {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [editar, setEditar] = useState(null);     // null | 'nuevo' | huesped
  const [mensaje, setMensaje] = useState('');
  const accion = useAccion();

  const buscar = (texto) => texto.trim().length >= 2 ? pmsApi.buscarHuespedes(texto).then(setLista).catch(() => setLista([])) : setLista(null);
  useEffect(() => { const t = setTimeout(() => buscar(q), 300); return () => clearTimeout(t); }, [q]);

  const guardar = async (datos) => {
    const nuevo = editar === 'nuevo';
    // El documento llega oculto (RN-34): si no se cambió, no se manda
    const { numDocumento, tipoDocumento, ...resto } = datos;
    const cuerpo = nuevo || !numDocumento?.includes('*') ? datos : resto;
    const { ok, valor } = await accion.ejecutar(() => nuevo ? pmsApi.registrarHuesped(cuerpo) : pmsApi.actualizarHuesped(editar.id, cuerpo));
    if (ok) { setEditar(null); setMensaje(`${valor.nombreCompleto} ${nuevo ? 'registrado' : 'actualizado'}.`); setQ(valor.apellidos); buscar(valor.apellidos); }
  };

  return (
    <>
      <Encabezado titulo="Huéspedes" subtitulo="Registro compartido entre los hoteles">
        <Boton tipo="primario" onClick={() => { accion.setError(null); setEditar('nuevo'); }}>+ Registrar huésped</Boton>
      </Encabezado>
      {mensaje && <div style={{ marginBottom: 14 }}><Aviso tipo="ok">{mensaje}</Aviso></div>}
      <section className="tarjeta">
        <div className="tarjeta-cuerpo">
          <Campo etiqueta="Buscar" ayuda="Por nombre, teléfono, correo o documento (mínimo 2 letras)">
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </Campo>
        </div>
        {lista === null ? null : lista.length === 0 ? <Vacio>Sin resultados.</Vacio> : (
          <div className="tabla-caja" style={{ borderTop: '1px solid var(--linea)' }}><table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Documento</th><th>Origen</th></tr></thead>
            <tbody>{lista.map((h) => (
              <tr key={h.id} onClick={() => { accion.setError(null); setEditar(h); }}>
                <td><b>{h.nombreCompleto}</b></td><td>{h.telefono ?? '—'}</td><td>{h.email ?? '—'}</td>
                <td className="mono">{h.documento ? `${h.tipoDocumento} ${h.documento}` : '—'}</td><td>{h.ciudadOrigen ?? '—'}</td>
              </tr>))}
            </tbody>
          </table></div>)}
      </section>
      {editar && (
        <Modal titulo={editar === 'nuevo' ? 'Registrar huésped' : 'Editar huésped'} alCerrar={() => setEditar(null)}
               pie={<><Boton onClick={() => setEditar(null)}>Cancelar</Boton><Boton tipo="primario" cargando={accion.ocupado} form="form-huesped" type="submit">Guardar</Boton></>}>
          <div className="formulario">
            <Aviso error={accion.error} />
            <FormHuesped inicial={editar === 'nuevo' ? undefined : { ...editar, numDocumento: editar.documento }} alEnviar={guardar} />
          </div>
        </Modal>)}
    </>
  );
}
