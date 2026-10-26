// Ventanas para check-in, cancelar y cobrar. Se usan en el tablero y en el detalle.
import { useState } from 'react';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { METODOS_PAGO } from '../../domain/estados.js';
import { dinero } from '../../domain/formato.js';
import { Aviso, Boton, Campo, Modal } from './comunes.jsx';

export function ModalCheckIn({ reservacion, alCerrar, alTerminar }) {
  const [placas, setPlacas] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const { ocupado, error, ejecutar } = useAccion();
  const hacer = async () => {
    const { ok } = await ejecutar(() => pmsApi.checkIn(reservacion.id, { placas, observaciones }));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo={`Check-in · Hab. ${reservacion.habitacion.numero}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={ocupado} onClick={hacer}>Registrar llegada</Boton></>}>
      <div className="formulario">
        <p style={{ margin: 0 }}><b>{reservacion.huesped.nombre}</b><br /><span className="suave">Código {reservacion.codigo} · saldo {dinero(reservacion.saldo)}</span></p>
        <Aviso error={error} />
        <Campo etiqueta="Placas del vehículo" ayuda="Opcional. Se guardan sin guiones ni espacios.">
          <input value={placas} onChange={(e) => setPlacas(e.target.value)} placeholder="DBC-1234" />
        </Campo>
        <Campo etiqueta="Observaciones"><textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
      </div>
    </Modal>
  );
}

export function ModalCancelar({ reservacion, alCerrar, alTerminar }) {
  const [motivo, setMotivo] = useState('');
  const { ocupado, error, ejecutar } = useAccion();
  const hacer = async () => { const { ok } = await ejecutar(() => pmsApi.cancelar(reservacion.id, motivo)); if (ok) alTerminar(); };
  return (
    <Modal titulo={`Cancelar ${reservacion.codigo}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Volver</Boton><Boton tipo="peligro" cargando={ocupado} onClick={hacer}>Cancelar reservación</Boton></>}>
      <div className="formulario">
        <Aviso error={error} />
        <Campo etiqueta="Motivo de la cancelación" ayuda="Obligatorio (RN-12). Ayuda al hotel a saber por qué pierde clientes.">
          <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Campo>
      </div>
    </Modal>
  );
}

export function ModalPago({ reservacion, saldo, alCerrar, alTerminar }) {
  const [pago, setPago] = useState({ monto: String(saldo ?? ''), metodo: 'efectivo', referencia: '', esAnticipo: false });
  const { ocupado, error, ejecutar } = useAccion();
  const cambiar = (k) => (e) => setPago({ ...pago, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const necesitaRef = pago.metodo === 'transferencia' || pago.metodo === 'deposito';
  const hacer = async (e) => {
    e.preventDefault();
    const { ok } = await ejecutar(() => pmsApi.registrarPago(reservacion.id, pago));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo={`Cobrar · ${reservacion.codigo}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={ocupado} form="form-pago" type="submit">Registrar pago</Boton></>}>
      <form id="form-pago" className="formulario" onSubmit={hacer}>
        <p style={{ margin: 0 }} className="suave">Saldo pendiente: <b style={{ color: 'var(--tinta)' }}>{dinero(saldo)}</b></p>
        <Aviso error={error} />
        <div className="fila">
          <Campo etiqueta="Monto (MXN)"><input inputMode="decimal" value={pago.monto} onChange={cambiar('monto')} required /></Campo>
          <Campo etiqueta="Método">
            <select value={pago.metodo} onChange={cambiar('metodo')}>
              {Object.entries(METODOS_PAGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
        </div>
        {necesitaRef && <Campo etiqueta="Número de referencia" ayuda="Obligatorio en transferencias y depósitos (RN-56)">
          <input value={pago.referencia} onChange={cambiar('referencia')} required />
        </Campo>}
        <label className="check"><input type="checkbox" checked={pago.esAnticipo} onChange={cambiar('esAnticipo')} /> Es anticipo</label>
      </form>
    </Modal>
  );
}
