import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../../application/SesionContext.jsx';
import { useConsulta } from '../../application/hooks/useConsulta.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { ESTADOS_HABITACION } from '../../domain/estados.js';
import { dinero, fechaLarga, fechaCorta, hoyISO, plural, sumarDias } from '../../domain/formato.js';
import { Aviso, Boton, Cargando, Encabezado, EstadoReservacion, Vacio } from '../components/comunes.jsx';
import { ModalCheckIn } from '../components/AccionesEstancia.jsx';

export default function Tablero() {
  const { hotelId, hotel, recargarHoteles } = useSesion();
  const navegar = useNavigate();
  // Desde AYER: quien sale hoy durmió su última noche ayer, así que una consulta
  // que empiece hoy no lo traería (las fechas son [entrada, salida), la salida no cuenta).
  const agenda = useConsulta(() => pmsApi.agenda(hotelId, { desde: sumarDias(hoyISO(), -1), hasta: sumarDias(hoyISO(), 1) }), [hotelId]);
  const cuartos = useConsulta(() => pmsApi.habitaciones(hotelId), [hotelId]);
  const [checkIn, setCheckIn] = useState(null);
  const accion = useAccion();

  const recargar = () => { agenda.recargar(); cuartos.recargar(); recargarHoteles(); };
  if (agenda.cargando && !agenda.datos) return <Cargando />;
  if (agenda.error) return <Aviso error={agenda.error} />;

  const { hoy, reservaciones } = agenda.datos;
  const llegan = reservaciones.filter((r) => r.entrada === hoy && ['pendiente', 'confirmada'].includes(r.estado));
  const salen = reservaciones.filter((r) => r.salida === hoy && r.estado === 'check_in');
  const hospedados = reservaciones.filter((r) => r.estado === 'check_in');
  const lista = cuartos.datos ?? [];
  const porLimpiar = lista.filter((c) => c.estado === 'limpieza').length;
  const ocup = hotel?.ocupacionHoy ?? { habitaciones: lista.length, ocupadas: 0, porcentaje: 0 };

  const checkOut = async (r) => {
    if (r.saldo > 0) return navegar(`/reservaciones/${r.id}`);   // RN-52: primero cobrar
    const { ok } = await accion.ejecutar(() => pmsApi.checkOut(r.id));
    if (ok) recargar();
  };
  const confirmar = async (r) => { const { ok } = await accion.ejecutar(() => pmsApi.confirmar(r.id)); if (ok) recargar(); };

  return (
    <>
      <Encabezado titulo={hotel?.nombre ?? 'Tablero'} subtitulo={`Hoy es ${fechaLarga(hoy)}`}>
        <Link className="boton primario" to="/nueva">+ Nueva reservación</Link>
      </Encabezado>

      <div className="kpis">
        <div className="tarjeta kpi">
          <div className="etiqueta">Ocupación hoy</div>
          <div className="valor num">{Math.round(ocup.porcentaje)}%</div>
          <div className="detalle">{ocup.ocupadas} de {plural(ocup.habitaciones, 'habitación', 'habitaciones')}</div>
          <div className="barra-progreso"><div style={{ width: `${ocup.porcentaje}%` }} /></div>
        </div>
        <div className="tarjeta kpi"><div className="etiqueta">Llegan hoy</div><div className="valor num">{llegan.length}</div><div className="detalle">{llegan.filter((r) => r.estado === 'pendiente').length} sin confirmar</div></div>
        <div className="tarjeta kpi"><div className="etiqueta">Salen hoy</div><div className="valor num">{salen.length}</div><div className="detalle">{dinero(salen.reduce((s, r) => s + r.saldo, 0))} por cobrar</div></div>
        <div className="tarjeta kpi"><div className="etiqueta">Por limpiar</div><div className="valor num">{porLimpiar}</div><div className="detalle">{plural(hospedados.length, 'cuarto ocupado', 'cuartos ocupados')}</div></div>
      </div>

      <Aviso error={accion.error} />

      <div className="rejilla rejilla-2" style={{ marginTop: accion.error ? 14 : 0 }}>
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2>🧳 Llegan hoy</h2><span className="suave">{llegan.length}</span></div>
          {llegan.length === 0 ? <Vacio>Nadie más llega hoy.</Vacio> : (
            <ul className="lista">{llegan.map((r) => (
              <li key={r.id}>
                <Link to={`/reservaciones/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="principal">{r.huesped.nombre}</div>
                  <div className="secundario">Hab. {r.habitacion.numero} · {plural(r.noches, 'noche', 'noches')} · <EstadoReservacion estado={r.estado} /></div>
                </Link>
                {r.estado === 'confirmada'
                  ? <Boton tipo="primario" chico onClick={() => setCheckIn(r)}>Check-in</Boton>
                  : <Boton chico cargando={accion.ocupado} onClick={() => confirmar(r)}>Confirmar</Boton>}
              </li>))}
            </ul>)}
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cab"><h2>👋 Salen hoy</h2><span className="suave">{salen.length}</span></div>
          {salen.length === 0 ? <Vacio>Nadie sale hoy.</Vacio> : (
            <ul className="lista">{salen.map((r) => (
              <li key={r.id}>
                <Link to={`/reservaciones/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="principal">{r.huesped.nombre}</div>
                  <div className="secundario">Hab. {r.habitacion.numero} · {r.saldo > 0 ? <b style={{ color: 'var(--rojo)' }}>debe {dinero(r.saldo)}</b> : 'pagado'}</div>
                </Link>
                <Boton chico tipo={r.saldo > 0 ? '' : 'primario'} cargando={accion.ocupado} onClick={() => checkOut(r)}>
                  {r.saldo > 0 ? 'Cobrar' : 'Check-out'}
                </Boton>
              </li>))}
            </ul>)}
        </section>
      </div>

      <section className="tarjeta" style={{ marginTop: 16 }}>
        <div className="tarjeta-cab">
          <h2>🛏️ Habitaciones</h2>
          <div className="leyenda">{Object.entries(ESTADOS_HABITACION).map(([k, e]) => <span key={k}><span className={`chip ${e.tono}`}>{e.texto}</span></span>)}</div>
        </div>
        <div className="tarjeta-cuerpo">
          {cuartos.cargando && !cuartos.datos ? <Cargando /> : (
            <div className="mini-cuartos">
              {lista.map((c) => {
                const r = hospedados.find((x) => x.habitacion.id === c.id);
                return <span key={c.id} className={`mini-cuarto ${ESTADOS_HABITACION[c.estado]?.tono}`}
                             title={`${c.tipo} · ${ESTADOS_HABITACION[c.estado]?.texto}${r ? ` · ${r.huesped.nombre} (sale ${fechaCorta(r.salida)})` : ''}`}>{c.numero}</span>;
              })}
            </div>)}
        </div>
      </section>

      {checkIn && <ModalCheckIn reservacion={checkIn} alCerrar={() => setCheckIn(null)} alTerminar={() => { setCheckIn(null); recargar(); }} />}
    </>
  );
}
