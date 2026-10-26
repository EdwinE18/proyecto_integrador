import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useConsulta } from '../../application/hooks/useConsulta.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { CANALES, METODOS_PAGO } from '../../domain/estados.js';
import { dinero, fechaHora, fechaLarga, plural } from '../../domain/formato.js';
import { Aviso, Boton, Cargando, Encabezado, EstadoReservacion, Vacio } from '../components/comunes.jsx';
import { ModalCancelar, ModalCheckIn, ModalPago } from '../components/AccionesEstancia.jsx';

export default function DetalleReservacion() {
  const { id } = useParams();
  const { state } = useLocation();
  const detalle = useConsulta(() => pmsApi.detalleReservacion(id), [id]);
  const cuenta = useConsulta(() => pmsApi.cuenta(id), [id]);
  const [modal, setModal] = useState(null);
  const [mensaje, setMensaje] = useState(state?.creada ? 'Reservación creada.' : '');
  const accion = useAccion();

  const recargar = (texto = '') => { setModal(null); setMensaje(texto); detalle.recargar(); cuenta.recargar(); };
  const hacer = async (fn, texto) => { setMensaje(''); const { ok } = await accion.ejecutar(fn); if (ok) recargar(texto); };

  if (detalle.cargando && !detalle.datos) return <Cargando />;
  if (detalle.error) return <><Aviso error={detalle.error} /><p><Link to="/reservaciones">← Volver</Link></p></>;
  const r = detalle.datos;
  const c = cuenta.datos;
  const saldo = c?.saldo ?? r.saldo;

  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link to="/reservaciones">← Reservaciones</Link></p>
      <Encabezado titulo={<>{r.huesped.nombre} <EstadoReservacion estado={r.estado} /></>}
                  subtitulo={<>Código <span className="mono">{r.codigo}</span> · Hab. {r.habitacion.numero} ({r.habitacion.tipo})</>}>
        {r.estado === 'pendiente' && <Boton tipo="primario" cargando={accion.ocupado} onClick={() => hacer(() => pmsApi.confirmar(r.id), 'Reservación confirmada.')}>Confirmar</Boton>}
        {r.estado === 'confirmada' && <Boton tipo="primario" onClick={() => setModal('checkin')}>Check-in</Boton>}
        {r.estado === 'check_in' && (saldo > 0
          ? <Boton tipo="primario" onClick={() => setModal('pago')}>Cobrar {dinero(saldo)} para salir</Boton>
          : <Boton tipo="primario" cargando={accion.ocupado} onClick={() => hacer(() => pmsApi.checkOut(r.id), 'Check-out registrado. La habitación pasó a limpieza.')}>Check-out</Boton>)}
        {['pendiente', 'confirmada'].includes(r.estado) && <Boton tipo="peligro" onClick={() => setModal('cancelar')}>Cancelar</Boton>}
      </Encabezado>

      {mensaje && <div style={{ marginBottom: 14 }}><Aviso tipo="ok">{mensaje}</Aviso></div>}
      {accion.error && <div style={{ marginBottom: 14 }}><Aviso error={accion.error} /></div>}

      <div className="rejilla rejilla-2">
        <section className="tarjeta tarjeta-cuerpo resumen">
          <h2 style={{ marginBottom: 14 }}>Estancia</h2>
          <dl>
            <dt>Llegada</dt><dd>{fechaLarga(r.entrada)}</dd>
            <dt>Salida</dt><dd>{fechaLarga(r.salida)}</dd>
            <dt>Noches</dt><dd>{r.noches}</dd>
            <dt>Personas</dt><dd>{plural(r.numAdultos, 'adulto', 'adultos')}{r.numNinos > 0 && `, ${plural(r.numNinos, 'niño', 'niños')}`}</dd>
            <dt>Canal</dt><dd>{CANALES[r.canal] ?? r.canal}</dd>
            <dt>Teléfono</dt><dd>{r.huesped.telefono ?? '—'}</dd>
            <dt>Correo</dt><dd>{r.huesped.email ?? '—'}</dd>
            {r.estancia && <><dt>Llegó</dt><dd>{fechaHora(r.estancia.checkInReal)}</dd></>}
            {r.estancia?.checkOutReal && <><dt>Salió</dt><dd>{fechaHora(r.estancia.checkOutReal)}</dd></>}
            {r.estancia?.placasVehiculo && <><dt>Placas</dt><dd className="mono">{r.estancia.placasVehiculo}</dd></>}
            {r.estancia?.observaciones && <><dt>Notas</dt><dd style={{ fontWeight: 400 }}>{r.estancia.observaciones}</dd></>}
            {r.motivoCancelacion && <><dt>Motivo</dt><dd style={{ fontWeight: 400 }}>{r.motivoCancelacion}</dd></>}
          </dl>
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Cuenta</h2>
            {['pendiente', 'confirmada', 'check_in'].includes(r.estado) && saldo > 0 && <Boton chico onClick={() => setModal('pago')}>+ Registrar pago</Boton>}
          </div>
          <div className="tarjeta-cuerpo kpis" style={{ margin: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div><div className="suave" style={{ fontSize: 12.5 }}>Total</div><b className="num" style={{ fontSize: 18 }}>{dinero(c?.total ?? r.total)}</b></div>
            <div><div className="suave" style={{ fontSize: 12.5 }}>Pagado</div><b className="num" style={{ fontSize: 18 }}>{dinero(c?.pagado ?? r.pagado)}</b></div>
            <div><div className="suave" style={{ fontSize: 12.5 }}>Saldo</div><b className="num" style={{ fontSize: 18, color: saldo > 0 ? 'var(--rojo)' : 'var(--verde)' }}>{dinero(saldo)}</b></div>
          </div>
          {!c ? <Cargando /> : c.pagos.length === 0 ? <Vacio>Aún no hay pagos.</Vacio> : (
            <ul className="lista" style={{ borderTop: '1px solid var(--linea)' }}>
              {c.pagos.map((p) => (
                <li key={p.id}>
                  <div><div className="principal num">{dinero(p.monto)}</div>
                    <div className="secundario">{METODOS_PAGO[p.metodo]}{p.referencia && ` · ${p.referencia}`}{p.esAnticipo && ' · anticipo'} · {fechaHora(p.fechaPago)}</div></div>
                </li>))}
            </ul>)}
        </section>
      </div>

      {modal === 'checkin' && <ModalCheckIn reservacion={r} alCerrar={() => setModal(null)} alTerminar={() => recargar('Check-in registrado. ¡Bienvenido!')} />}
      {modal === 'cancelar' && <ModalCancelar reservacion={r} alCerrar={() => setModal(null)} alTerminar={() => recargar('Reservación cancelada. Las fechas quedaron libres.')} />}
      {modal === 'pago' && <ModalPago reservacion={r} saldo={saldo} alCerrar={() => setModal(null)} alTerminar={() => recargar('Pago registrado.')} />}
    </>
  );
}
