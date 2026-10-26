import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../../application/SesionContext.jsx';
import { useConsulta } from '../../application/hooks/useConsulta.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { ESTADOS_RESERVACION, CANALES } from '../../domain/estados.js';
import { dinero, fechaCorta, hoyISO, sumarDias } from '../../domain/formato.js';
import { Aviso, Campo, Cargando, Encabezado, EstadoReservacion, Vacio } from '../components/comunes.jsx';

const ACTIVAS = ['pendiente', 'confirmada', 'check_in'];

export default function Reservaciones() {
  const { hotelId } = useSesion();
  const navegar = useNavigate();
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(sumarDias(hoyISO(), 30));
  const [estados, setEstados] = useState(ACTIVAS);
  const [texto, setTexto] = useState('');
  const valido = desde && hasta && hasta > desde;
  const agenda = useConsulta(() => valido ? pmsApi.agenda(hotelId, { desde, hasta, estados: estados.join(',') }) : null,
                             [hotelId, desde, hasta, estados.join(',')]);

  const alternar = (e) => setEstados((l) => l.includes(e) ? l.filter((x) => x !== e) : [...l, e]);
  const q = texto.trim().toLowerCase();
  const filas = (agenda.datos?.reservaciones ?? []).filter((r) =>
    !q || r.codigo.toLowerCase().includes(q) || r.huesped.nombre.toLowerCase().includes(q) || r.habitacion.numero.toLowerCase().includes(q));

  return (
    <>
      <Encabezado titulo="Reservaciones" subtitulo="Todas las reservaciones que se cruzan con las fechas elegidas">
        <Link className="boton primario" to="/nueva">+ Nueva reservación</Link>
      </Encabezado>
      <div className="tarjeta tarjeta-cuerpo formulario" style={{ marginBottom: 14 }}>
        <div className="fila">
          <Campo etiqueta="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo etiqueta="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
          <Campo etiqueta="Buscar"><input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Código, huésped o cuarto" /></Campo>
        </div>
        <div className="botones">
          {Object.entries(ESTADOS_RESERVACION).map(([k, e]) => (
            <label key={k} className="check" style={{ marginRight: 8 }}>
              <input type="checkbox" checked={estados.includes(k)} onChange={() => alternar(k)} /> {e.texto}
            </label>))}
        </div>
      </div>
      {!valido && <Aviso error={{ message: 'La fecha "hasta" debe ser posterior a "desde"' }} />}
      <Aviso error={agenda.error} />
      <section className="tarjeta">
        {agenda.cargando && !agenda.datos ? <Cargando /> : filas.length === 0 ? <Vacio>No hay reservaciones con esos filtros.</Vacio> : (
          <div className="tabla-caja"><table>
            <thead><tr><th>Código</th><th>Huésped</th><th>Hab.</th><th>Llega</th><th>Sale</th><th>Noches</th><th>Canal</th><th>Estado</th><th className="derecha">Total</th><th className="derecha">Saldo</th></tr></thead>
            <tbody>{filas.map((r) => (
              <tr key={r.id} onClick={() => navegar(`/reservaciones/${r.id}`)}>
                <td className="mono">{r.codigo}</td><td><b>{r.huesped.nombre}</b></td><td>{r.habitacion.numero}</td>
                <td>{fechaCorta(r.entrada)}</td><td>{fechaCorta(r.salida)}</td><td className="num">{r.noches}</td>
                <td className="suave">{CANALES[r.canal] ?? r.canal}</td><td><EstadoReservacion estado={r.estado} /></td>
                <td className="derecha num">{dinero(r.total)}</td>
                <td className="derecha num" style={{ color: r.saldo > 0 && r.estado !== 'cancelada' ? 'var(--rojo)' : undefined }}>{dinero(r.saldo)}</td>
              </tr>))}
            </tbody>
          </table></div>)}
      </section>
    </>
  );
}
