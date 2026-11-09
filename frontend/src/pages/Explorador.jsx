import { useState } from 'react';
import { useConsulta } from '../hooks/useConsulta.js';
import { pmsApi } from '../services/pmsApi.js';
import { Aviso, Boton, Cargando, Encabezado } from '../components/comunes.jsx';

const POR_PAGINA = 25;
const mostrar = (v) => (v === null || v === undefined ? <span className="tenue">null</span>
  : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Para enseñar la base de datos en la exposición: tablas, columnas, llaves y filas (solo admin). */
export default function Explorador() {
  const tablas = useConsulta(() => pmsApi.tablas(), []);
  const [actual, setActual] = useState('reservaciones');
  const [pagina, setPagina] = useState(0);
  const tabla = useConsulta(() => pmsApi.tabla(actual, { limite: POR_PAGINA, desplazamiento: pagina * POR_PAGINA }), [actual, pagina]);
  const t = tabla.datos;

  return (
    <>
      <Encabezado titulo="Base de datos" subtitulo="Tablas de PostgreSQL con sus columnas, relaciones y datos (las contraseñas se ocultan)" />
      <div className="explorador">
        <nav className="tarjeta lista-tablas" aria-label="Tablas">
          {!tablas.datos ? <Cargando /> : tablas.datos.map((x) => (
            <button key={x.nombre} className={x.nombre === actual ? 'activa' : ''} onClick={() => { setActual(x.nombre); setPagina(0); }}>
              <span className="mono">{x.nombre}</span><span className="tenue num">{x.filas}</span>
            </button>))}
        </nav>
        <div style={{ minWidth: 0 }}>
          <Aviso error={tabla.error ?? tablas.error} />
          {!t ? <Cargando /> : (
            <>
              <section className="tarjeta" style={{ marginBottom: 14 }}>
                <div className="tarjeta-cab"><h2 className="mono">{t.nombre}</h2><span className="suave">{t.total} filas · {t.columnas.length} columnas</span></div>
                <div className="tabla-caja"><table>
                  <thead><tr><th>Columna</th><th>Tipo</th><th>Nulo</th><th>Llave</th><th>Por omisión</th></tr></thead>
                  <tbody>{t.columnas.map((c) => (
                    <tr key={c.nombre} style={{ cursor: 'default' }}>
                      <td className="mono"><b>{c.nombre}</b></td><td className="mono suave">{c.tipo}</td><td>{c.nulo ? 'sí' : 'no'}</td>
                      <td>{c.pk ? '🔑 PK' : c.fk ? `→ ${c.fk}` : ''}</td><td className="mono tenue">{c.defecto ?? ''}</td>
                    </tr>))}
                  </tbody>
                </table></div>
                {t.reglas?.length > 0 && (
                  <div className="tarjeta-cuerpo" style={{ borderTop: '1px solid var(--linea)' }}>
                    <b style={{ fontSize: 13 }}>Restricciones</b>
                    <ul className="mono suave" style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5 }}>
                      {t.reglas.map((r) => <li key={r.nombre}><b>{r.tipo}</b> {r.nombre}: {r.definicion}</li>)}
                    </ul>
                  </div>)}
              </section>
              <section className="tarjeta">
                <div className="tarjeta-cab">
                  <h2>Datos</h2>
                  <div className="botones">
                    <Boton chico disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Anterior</Boton>
                    <span className="suave num" style={{ alignSelf: 'center' }}>{t.total === 0 ? 0 : pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, t.total)} de {t.total}</span>
                    <Boton chico disabled={(pagina + 1) * POR_PAGINA >= t.total} onClick={() => setPagina(pagina + 1)}>Siguiente →</Boton>
                  </div>
                </div>
                <div className="tabla-caja"><table className="tabla-datos">
                  <thead><tr>{t.columnas.map((c) => <th key={c.nombre} className="mono">{c.nombre}</th>)}</tr></thead>
                  <tbody>{t.filas.map((f, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>{t.columnas.map((c) => <td key={c.nombre} className="mono">{mostrar(f[c.nombre])}</td>)}</tr>))}
                  </tbody>
                </table></div>
              </section>
            </>)}
        </div>
      </div>
    </>
  );
}
