import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../application/SesionContext.jsx';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { CANALES } from '../../domain/estados.js';
import { dinero, fechaCorta, fechaLarga, hoyISO, plural, sumarDias } from '../../domain/formato.js';
import { Aviso, Boton, Campo, Encabezado, Vacio } from '../components/comunes.jsx';
import { FormHuesped } from '../components/FormHuesped.jsx';

const PASOS = ['Fechas', 'Habitación', 'Huésped', 'Confirmar'];

export default function NuevaReservacion() {
  const { hotelId, hotel } = useSesion();
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [busqueda, setBusqueda] = useState({ entrada: hoyISO(), salida: sumarDias(hoyISO(), 1), adultos: 2, ninos: 0 });
  const [resultado, setResultado] = useState(null);
  const [cuarto, setCuarto] = useState(null);
  const [huesped, setHuesped] = useState(null);
  const [canal, setCanal] = useState('mostrador');
  const [confirmarYa, setConfirmarYa] = useState(true);
  const accion = useAccion();

  const cambiar = (k) => (e) => setBusqueda({ ...busqueda, [k]: e.target.value });

  const buscar = async (e) => {
    e.preventDefault();
    const { ok, valor } = await accion.ejecutar(() => pmsApi.disponibilidad(hotelId, busqueda));
    if (ok) { setResultado(valor); setCuarto(null); setPaso(1); }
  };

  const crear = async () => {
    const { ok, valor } = await accion.ejecutar(async () => {
      // El precio NO se manda: lo calcula el backend (RN-61)
      const r = await pmsApi.crearReservacion({
        hotelId, huespedId: huesped.id, habitacionId: cuarto.id, canal,
        entrada: resultado.entrada, salida: resultado.salida,
        numAdultos: Number(resultado.adultos), numNinos: Number(resultado.ninos),
      });
      if (confirmarYa) await pmsApi.confirmar(r.id);
      return r;
    });
    if (ok) navegar(`/reservaciones/${valor.id}`, { state: { creada: true } });
  };

  return (
    <>
      <Encabezado titulo="Nueva reservación" subtitulo={hotel?.nombre} />
      <div className="pasos">
        {PASOS.map((p, i) => (
          <span key={p} className={`paso ${i === paso ? 'actual' : i < paso ? 'hecho' : ''}`}><b>{i < paso ? '✓' : i + 1}</b>{p}</span>
        ))}
      </div>
      <Aviso error={accion.error} />
      <div style={{ height: accion.error ? 14 : 0 }} />

      {paso === 0 && (
        <form className="tarjeta tarjeta-cuerpo formulario" onSubmit={buscar} style={{ maxWidth: 640 }}>
          <div className="fila">
            <Campo etiqueta="Llegada"><input type="date" value={busqueda.entrada} min={hoyISO()} onChange={cambiar('entrada')} required /></Campo>
            <Campo etiqueta="Salida"><input type="date" value={busqueda.salida} min={sumarDias(busqueda.entrada, 1)} onChange={cambiar('salida')} required /></Campo>
          </div>
          <div className="fila">
            <Campo etiqueta="Adultos"><input type="number" min={1} max={10} value={busqueda.adultos} onChange={cambiar('adultos')} required /></Campo>
            <Campo etiqueta="Niños"><input type="number" min={0} max={10} value={busqueda.ninos} onChange={cambiar('ninos')} required /></Campo>
          </div>
          <div><Boton tipo="primario" cargando={accion.ocupado} type="submit">Buscar habitaciones libres</Boton></div>
        </form>
      )}

      {paso === 1 && resultado && (
        <div className="formulario" style={{ maxWidth: 760 }}>
          <p className="suave" style={{ margin: 0 }}>
            {fechaLarga(resultado.entrada)} → {fechaLarga(resultado.salida)} · {plural(resultado.noches, 'noche', 'noches')} ·{' '}
            {plural(resultado.adultos, 'adulto', 'adultos')}{resultado.ninos > 0 && `, ${plural(resultado.ninos, 'niño', 'niños')}`}
          </p>
          {resultado.habitaciones.length === 0
            ? <div className="tarjeta"><Vacio>No hay habitaciones libres para esas fechas y personas. Prueba con otras fechas.</Vacio></div>
            : resultado.habitaciones.map((h) => (
              <button key={h.id} className={`opcion ${cuarto?.id === h.id ? 'elegida' : ''}`} onClick={() => setCuarto(h)}>
                <div>
                  <b style={{ fontSize: 16 }}>Hab. {h.numero}</b> <span className="suave">· {h.tipo} · hasta {plural(h.capacidadAdultos, 'adulto', 'adultos')}{h.capacidadNinos > 0 && ` y ${plural(h.capacidadNinos, 'niño', 'niños')}`}</span>
                  {h.amenidades?.length > 0 && <div className="tenue" style={{ fontSize: 12.5 }}>{h.amenidades.join(' · ')}</div>}
                  <div className="desglose">
                    {h.desglose.map((n) => <span key={n.fecha}>{fechaCorta(n.fecha)}: {dinero(n.precio)} {n.temporada && <span className="etiqueta-temporada">{n.temporada}</span>}</span>)}
                  </div>
                </div>
                <div className="derecha"><div className="total-grande num" style={{ fontSize: 20 }}>{dinero(h.total)}</div><div className="tenue" style={{ fontSize: 12 }}>{dinero(h.promedioNoche)} / noche</div></div>
              </button>
            ))}
          <div className="botones">
            <Boton onClick={() => setPaso(0)}>← Cambiar fechas</Boton>
            <Boton tipo="primario" disabled={!cuarto} onClick={() => setPaso(2)}>Continuar</Boton>
          </div>
        </div>
      )}

      {paso === 2 && <ElegirHuesped elegido={huesped} alElegir={(h) => { setHuesped(h); setPaso(3); }} alVolver={() => setPaso(1)} />}

      {paso === 3 && (
        <div className="rejilla rejilla-2" style={{ maxWidth: 860 }}>
          <section className="tarjeta tarjeta-cuerpo resumen">
            <h2 style={{ marginBottom: 14 }}>Resumen</h2>
            <dl>
              <dt>Huésped</dt><dd>{huesped.nombreCompleto}</dd>
              <dt>Habitación</dt><dd>{cuarto.numero} · {cuarto.tipo}</dd>
              <dt>Llegada</dt><dd>{fechaLarga(resultado.entrada)}</dd>
              <dt>Salida</dt><dd>{fechaLarga(resultado.salida)}</dd>
              <dt>Personas</dt><dd>{plural(Number(resultado.adultos), 'adulto', 'adultos')}{Number(resultado.ninos) > 0 && `, ${plural(Number(resultado.ninos), 'niño', 'niños')}`}</dd>
            </dl>
          </section>
          <section className="tarjeta tarjeta-cuerpo formulario">
            <div><div className="suave">Total ({plural(resultado.noches, 'noche', 'noches')})</div><div className="total-grande num">{dinero(cuarto.total)}</div>
              <small className="tenue">Calculado por el sistema con la tarifa de cada noche.</small></div>
            <Campo etiqueta="¿Cómo reservó?">
              <select value={canal} onChange={(e) => setCanal(e.target.value)}>
                {Object.entries(CANALES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </Campo>
            <label className="check"><input type="checkbox" checked={confirmarYa} onChange={(e) => setConfirmarYa(e.target.checked)} /> Confirmar de una vez</label>
            <div className="botones">
              <Boton onClick={() => setPaso(2)}>← Atrás</Boton>
              <Boton tipo="primario" cargando={accion.ocupado} onClick={crear}>Crear reservación</Boton>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ElegirHuesped({ elegido, alElegir, alVolver }) {
  const [q, setQ] = useState(elegido?.nombreCompleto ?? '');
  const [lista, setLista] = useState([]);
  const [nuevo, setNuevo] = useState(false);
  const accion = useAccion();

  // Busca 300 ms después de dejar de escribir
  useEffect(() => {
    if (q.trim().length < 2) { setLista([]); return; }
    const t = setTimeout(() => pmsApi.buscarHuespedes(q).then(setLista).catch(() => setLista([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const registrar = async (datos) => {
    const { ok, valor } = await accion.ejecutar(() => pmsApi.registrarHuesped(datos));
    if (ok) alElegir(valor);
  };

  if (nuevo) return (
    <section className="tarjeta" style={{ maxWidth: 640 }}>
      <div className="tarjeta-cab"><h2>Registrar huésped</h2></div>
      <div className="tarjeta-cuerpo formulario">
        <Aviso error={accion.error} />
        <FormHuesped id="nuevo-huesped" alEnviar={registrar} />
        <div className="botones">
          <Boton onClick={() => setNuevo(false)}>← Buscar existente</Boton>
          <Boton tipo="primario" cargando={accion.ocupado} form="nuevo-huesped" type="submit">Registrar y continuar</Boton>
        </div>
      </div>
    </section>
  );

  return (
    <section className="tarjeta" style={{ maxWidth: 640 }}>
      <div className="tarjeta-cuerpo formulario">
        <Campo etiqueta="Buscar huésped" ayuda="Por nombre, teléfono, correo o documento">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. Martínez o 5512…" autoFocus />
        </Campo>
      </div>
      {lista.length > 0 && (
        <ul className="lista" style={{ borderTop: '1px solid var(--linea)' }}>
          {lista.map((h) => (
            <li key={h.id}>
              <div><div className="principal">{h.nombreCompleto}</div>
                <div className="secundario">{[h.telefono, h.email, h.documento && `${h.tipoDocumento} ${h.documento}`].filter(Boolean).join(' · ')}</div></div>
              <Boton chico tipo="primario" onClick={() => alElegir(h)}>Elegir</Boton>
            </li>))}
        </ul>)}
      {q.trim().length >= 2 && lista.length === 0 && <Vacio>No encontramos a nadie con “{q}”.</Vacio>}
      <div className="tarjeta-cuerpo botones" style={{ borderTop: '1px solid var(--linea)' }}>
        <Boton onClick={alVolver}>← Atrás</Boton>
        <Boton onClick={() => setNuevo(true)}>+ Registrar huésped nuevo</Boton>
      </div>
    </section>
  );
}
