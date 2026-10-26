import { useEffect } from 'react';
import { ESTADOS_HABITACION, ESTADOS_RESERVACION } from '../../domain/estados.js';

export const Chip = ({ tono = 'gris', children }) => <span className={`chip ${tono}`}>{children}</span>;

export const EstadoReservacion = ({ estado }) => {
  const e = ESTADOS_RESERVACION[estado] ?? { texto: estado, tono: 'gris' };
  return <Chip tono={e.tono}>{e.texto}</Chip>;
};

export const EstadoHabitacion = ({ estado }) => {
  const e = ESTADOS_HABITACION[estado] ?? { texto: estado, tono: 'gris' };
  return <Chip tono={e.tono}>{e.texto}</Chip>;
};

/** Muestra un error del backend con la regla de negocio que se rompió (ver docs/REGLAS_DE_NEGOCIO.md) */
export function Aviso({ error, tipo, children }) {
  if (!error && !children) return null;
  const clase = tipo ?? (error ? '' : 'info');
  return (
    <div className={`aviso ${clase}`} role={error ? 'alert' : 'status'}>
      <span>{error?.message ?? children}</span>
      {error?.regla && <span className="regla" title="Regla de negocio">{error.regla}</span>}
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }) {
  return <label className="campo"><span>{etiqueta}</span>{children}{ayuda && <small>{ayuda}</small>}</label>;
}

export function Boton({ tipo = '', chico, bloque, cargando, children, ...props }) {
  return (
    <button className={['boton', tipo, chico && 'chico', bloque && 'bloque'].filter(Boolean).join(' ')}
            disabled={cargando || props.disabled} {...props}>
      {cargando ? 'Un momento…' : children}
    </button>
  );
}

export function Modal({ titulo, alCerrar, children, pie }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [alCerrar]);
  return (
    <div className="fondo-modal" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="tarjeta-cab"><h2>{titulo}</h2><button className="cerrar" onClick={alCerrar} aria-label="Cerrar">×</button></div>
        <div className="tarjeta-cuerpo">{children}</div>
        {pie && <div className="pie">{pie}</div>}
      </div>
    </div>
  );
}

export const Cargando = ({ texto = 'Cargando…' }) => <div className="cargando">{texto}</div>;
export const Vacio = ({ children }) => <div className="vacio">{children}</div>;

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="encabezado">
      <div><h1>{titulo}</h1>{subtitulo && <p>{subtitulo}</p>}</div>
      {children && <div className="botones">{children}</div>}
    </div>
  );
}
