import { useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { useConsulta } from '../hooks/useConsulta.js';
import { pmsApi } from '../services/pmsApi.js';
import { CANALES, ESTADOS_RESERVACION, METODOS_PAGO } from '../utils/estados.js';
import { dinero, fechaCorta, hoyISO, sumarDias } from '../utils/formato.js';
import { Aviso, Boton, Campo, Cargando, Encabezado, Vacio } from '../components/comunes.jsx';

// Atajos de periodo: [texto, desde, hasta]
const atajos = (hoy) => [
  ['Últimos 7 días', sumarDias(hoy, -6), hoy],
  ['Últimos 30 días', sumarDias(hoy, -29), hoy],
  ['Este mes', `${hoy.slice(0, 7)}-01`, hoy],
  ['Próximos 30 días', hoy, sumarDias(hoy, 29)],
];

/** Indicadores de ocupación e ingresos para administración y gerencia (RN-78) */
export default function Reportes() {
  const { hotelId, hotel } = useSesion();
  const hoy = hoyISO();
  const [periodo, setPeriodo] = useState({ desde: sumarDias(hoy, -29), hasta: hoy });
  const [borrador, setBorrador] = useState(periodo);
  const r = useConsulta(() => pmsApi.reporte(hotelId, periodo), [hotelId, periodo.desde, periodo.hasta]);
  const d = r.datos;

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo={`${hotel?.nombre ?? ''} · ocupación, ingresos y canales de venta`} />

      <section className="tarjeta" style={{ marginBottom: 16 }}>
        <form className="tarjeta-cuerpo filtros-periodo" onSubmit={(e) => { e.preventDefault(); setPeriodo(borrador); }}>
          <Campo etiqueta="Desde"><input type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} required /></Campo>
          <Campo etiqueta="Hasta"><input type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} required /></Campo>
          <Boton tipo="primario" type="submit">Ver</Boton>
          <div className="botones">
            {atajos(hoy).map(([t, desde, hasta]) => (
              <Boton key={t} chico type="button" tipo={periodo.desde === desde && periodo.hasta === hasta ? 'primario' : ''}
                     onClick={() => { setBorrador({ desde, hasta }); setPeriodo({ desde, hasta }); }}>{t}</Boton>))}
          </div>
        </form>
      </section>

      <Aviso error={r.error} />
      {!d ? (r.cargando && <Cargando />) : (
        <>
          <div className="kpis">
            <Kpi etiqueta="Ocupación" valor={`${d.ocupacion}%`} detalle={`${d.nochesVendidas} de ${d.nochesDisponibles} noches`} barra={d.ocupacion} />
            <Kpi etiqueta="Tarifa promedio (ADR)" valor={dinero(d.adr)} detalle="por noche vendida" />
            <Kpi etiqueta="RevPAR" valor={dinero(d.revpar)} detalle="ingreso por habitación disponible" />
            <Kpi etiqueta="Cobrado" valor={dinero(d.cobrado)} detalle={`${d.cobradoPorMetodo.reduce((s, m) => s + m.pagos, 0)} pagos en el periodo`} />
            <Kpi etiqueta="Por cobrar hoy" valor={dinero(d.porCobrar)} detalle="reservaciones activas con saldo" />
          </div>

          <section className="tarjeta" style={{ marginBottom: 16 }}>
            <div className="tarjeta-cab"><h2>Ocupación por día</h2><span className="suave">{fechaCorta(d.desde)} – {fechaCorta(d.hasta)} · {d.habitaciones} habitaciones</span></div>
            <div className="tarjeta-cuerpo">
              <div className="grafica-barras" role="img" aria-label="Porcentaje de ocupación de cada día del periodo">
                {d.porDia.map((x) => (
                  <div key={x.fecha} className={`barra ${x.fecha === hoy ? 'hoy' : ''} ${x.fecha > hoy ? 'futuro' : ''}`}
                       title={`${fechaCorta(x.fecha)}: ${x.ocupadas} de ${d.habitaciones} (${x.ocupacion}%)`}>
                    <div style={{ height: `${Math.max(x.ocupacion, 1.5)}%` }} />
                  </div>))}
              </div>
              <div className="eje-barras"><span>{fechaCorta(d.desde)}</span><span>{fechaCorta(d.hasta)}</span></div>
              <p className="tenue" style={{ margin: '8px 0 0', fontSize: 12.5 }}>Pasa el cursor sobre una barra para ver el día. Las barras claras son días futuros (reservaciones ya confirmadas).</p>
            </div>
          </section>

          <div className="rejilla rejilla-2">
            <Tabla titulo="Cobrado por método de pago" vacio="Sin pagos en el periodo"
                   filas={d.cobradoPorMetodo.map((m) => [METODOS_PAGO[m.metodo] ?? m.metodo, m.pagos, dinero(m.monto)])}
                   columnas={['Método', 'Pagos', 'Monto']} total={d.cobrado} />
            <Tabla titulo="Nuevas reservaciones por canal" vacio="Sin reservaciones nuevas"
                   filas={d.porCanal.map((c) => [CANALES[c.canal] ?? c.canal, c.reservaciones])} columnas={['Canal', 'Reservaciones']} />
            <Tabla titulo="Reservaciones del periodo por estado" vacio="Sin reservaciones"
                   filas={d.porEstado.map((e) => [ESTADOS_RESERVACION[e.estado]?.texto ?? e.estado, e.reservaciones])} columnas={['Estado', 'Reservaciones']} />
            <Tabla titulo="Motivos de cancelación" vacio="🎉 Ninguna cancelación"
                   filas={d.cancelaciones.map((c) => [c.motivo, c.veces])} columnas={['Motivo', 'Veces']} />
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ etiqueta, valor, detalle, barra }) {
  return (
    <div className="tarjeta kpi">
      <div className="etiqueta">{etiqueta}</div>
      <div className="valor num">{valor}</div>
      <div className="detalle">{detalle}</div>
      {barra !== undefined && <div className="barra-progreso"><div style={{ width: `${Math.min(barra, 100)}%` }} /></div>}
    </div>
  );
}

function Tabla({ titulo, columnas, filas, vacio, total }) {
  return (
    <section className="tarjeta">
      <div className="tarjeta-cab"><h2>{titulo}</h2></div>
      {filas.length === 0 ? <Vacio>{vacio}</Vacio> : (
        <div className="tabla-caja"><table>
          <thead><tr>{columnas.map((c, i) => <th key={c} className={i > 0 ? 'derecha' : ''}>{c}</th>)}</tr></thead>
          <tbody>
            {filas.map((f) => <tr key={f[0]} style={{ cursor: 'default' }}>{f.map((v, i) => <td key={i} className={i > 0 ? 'derecha num' : ''}>{v}</td>)}</tr>)}
            {total !== undefined && <tr style={{ cursor: 'default' }}><td><b>Total</b></td>{columnas.slice(2).map((c) => <td key={c} />)}<td className="derecha num"><b>{dinero(total)}</b></td></tr>}
          </tbody>
        </table></div>)}
    </section>
  );
}
