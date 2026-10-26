import { useState } from 'react';
import { TIPOS_DOCUMENTO } from '../../domain/estados.js';
import { Campo } from './comunes.jsx';

export const HUESPED_VACIO = { nombre: '', apellidos: '', telefono: '', email: '', tipoDocumento: '', numDocumento: '', ciudadOrigen: '', notas: '' };

/** Formulario de huésped. Las reglas (RN-31 a RN-33) las valida el backend y el error se muestra arriba. */
export function FormHuesped({ inicial = HUESPED_VACIO, id = 'form-huesped', alEnviar }) {
  const [h, setH] = useState({ ...HUESPED_VACIO, ...inicial });
  const cambiar = (k) => (e) => setH({ ...h, [k]: e.target.value });
  return (
    <form id={id} className="formulario" onSubmit={(e) => { e.preventDefault(); alEnviar(h); }}>
      <div className="fila">
        <Campo etiqueta="Nombre(s)"><input value={h.nombre} onChange={cambiar('nombre')} required autoFocus /></Campo>
        <Campo etiqueta="Apellidos"><input value={h.apellidos} onChange={cambiar('apellidos')} required /></Campo>
      </div>
      <div className="fila">
        <Campo etiqueta="Teléfono"><input type="tel" value={h.telefono ?? ''} onChange={cambiar('telefono')} placeholder="961 123 4567" /></Campo>
        <Campo etiqueta="Correo"><input type="email" value={h.email ?? ''} onChange={cambiar('email')} /></Campo>
      </div>
      <small className="tenue" style={{ marginTop: -8 }}>Al menos uno de los dos, para poder confirmarle (RN-32).</small>
      <div className="fila">
        <Campo etiqueta="Documento">
          <select value={h.tipoDocumento ?? ''} onChange={cambiar('tipoDocumento')}>
            <option value="">Sin documento</option>
            {Object.entries(TIPOS_DOCUMENTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Número"><input value={h.numDocumento ?? ''} onChange={cambiar('numDocumento')} disabled={!h.tipoDocumento} /></Campo>
      </div>
      <Campo etiqueta="Ciudad de origen"><input value={h.ciudadOrigen ?? ''} onChange={cambiar('ciudadOrigen')} /></Campo>
      <Campo etiqueta="Notas" ayuda="Preferencias, alergias, ocasión especial…"><textarea rows={2} value={h.notas ?? ''} onChange={cambiar('notas')} /></Campo>
    </form>
  );
}
