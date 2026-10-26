import { useState } from 'react';
import { useSesion } from '../../application/SesionContext.jsx';
import { useConsulta } from '../../application/hooks/useConsulta.js';
import { useAccion } from '../../application/hooks/useAccion.js';
import { pmsApi } from '../../infrastructure/api/pmsApi.js';
import { CAMBIOS_HABITACION, ESTADOS_HABITACION, requiereServicio } from '../../domain/estados.js';
import { dinero } from '../../domain/formato.js';
import { Aviso, Boton, Campo, Cargando, Encabezado, EstadoHabitacion, Modal, Vacio } from '../components/comunes.jsx';

// Texto del botón según el cambio
const ACCION = {
  'limpieza>disponible': '✓ Ya está limpia',
  'disponible>limpieza': 'Pedir limpieza',
  'disponible>mantenimiento': 'Mantenimiento',
  'limpieza>mantenimiento': 'Mantenimiento',
  'mantenimiento>disponible': 'Regresar a servicio',
  'mantenimiento>limpieza': 'Reparada, falta limpiar',
  'fuera_servicio>disponible': 'Regresar a servicio',
};

export default function Habitaciones() {
  const { hotelId, hotel, puede, usuario } = useSesion();
  const cuartos = useConsulta(() => pmsApi.habitaciones(hotelId), [hotelId]);
  const [filtro, setFiltro] = useState(usuario.rol === 'limpieza' ? 'limpieza' : '');
  const [cambio, setCambio] = useState(null);           // { cuarto, a }
  const [resultado, setResultado] = useState(null);
  const accion = useAccion();

  // RN-72: limpieza solo ve los botones de limpieza; servicio requiere otro permiso
  const permitido = (de, a) => puede(requiereServicio(de, a) ? 'habitaciones:servicio' : 'habitaciones:limpieza');
  const opciones = (c) => CAMBIOS_HABITACION[c.estado].filter((a) => ACCION[`${c.estado}>${a}`] && permitido(c.estado, a));

  const aplicar = async (cuarto, a, comentario) => {
    const { ok, valor } = await accion.ejecutar(() => pmsApi.cambiarEstadoHabitacion(cuarto.id, a, comentario));
    if (ok) { setCambio(null); setResultado({ numero: cuarto.numero, a, afectadas: valor.reservacionesAfectadas }); cuartos.recargar(); }
  };
  const pulsar = (c, a) => requiereServicio(c.estado, a) && (a === 'mantenimiento' || a === 'fuera_servicio')
    ? (accion.setError(null), setCambio({ cuarto: c, a })) : aplicar(c, a);

  const lista = (cuartos.datos ?? []).filter((c) => !filtro || c.estado === filtro);
  const cuenta = (e) => (cuartos.datos ?? []).filter((c) => c.estado === e).length;

  return (
    <>
      <Encabezado titulo="Habitaciones" subtitulo={hotel?.nombre} />
      <div className="botones" style={{ marginBottom: 14 }}>
        <Boton chico tipo={!filtro ? 'primario' : ''} onClick={() => setFiltro('')}>Todas ({cuartos.datos?.length ?? 0})</Boton>
        {Object.entries(ESTADOS_HABITACION).map(([k, e]) => (
          <Boton key={k} chico tipo={filtro === k ? 'primario' : ''} onClick={() => setFiltro(k)}>{e.texto} ({cuenta(k)})</Boton>))}
      </div>
      {resultado && <div style={{ marginBottom: 14 }}>
        <Aviso tipo={resultado.afectadas?.length ? 'info' : 'ok'}>
          Habitación {resultado.numero}: {ESTADOS_HABITACION[resultado.a].texto.toLowerCase()}.
          {resultado.afectadas?.length > 0 && <> Hay que reubicar {resultado.afectadas.length} reservación(es): {resultado.afectadas.map((r) => `${r.codigo} (${r.huesped})`).join(', ')}.</>}
        </Aviso></div>}
      {!cambio && accion.error && <div style={{ marginBottom: 14 }}><Aviso error={accion.error} /></div>}
      <Aviso error={cuartos.error} />

      {cuartos.cargando && !cuartos.datos ? <Cargando /> : lista.length === 0
        ? <div className="tarjeta"><Vacio>{filtro === 'limpieza' ? '🎉 No hay cuartos por limpiar.' : 'No hay habitaciones con ese estado.'}</Vacio></div>
        : (
          <div className="cuartos">
            {lista.map((c) => (
              <div key={c.id} className={`cuarto ${ESTADOS_HABITACION[c.estado]?.tono}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <span className="numero">{c.numero}</span><EstadoHabitacion estado={c.estado} />
                </div>
                <span className="tipo">{c.tipo} · {c.capacidadAdultos} pers. · {dinero(c.precioBase)}</span>
                {opciones(c).map((a) => (
                  <Boton key={a} chico tipo={a === 'disponible' && c.estado === 'limpieza' ? 'primario' : ''} cargando={accion.ocupado} onClick={() => pulsar(c, a)}>
                    {ACCION[`${c.estado}>${a}`]}
                  </Boton>))}
                {c.estado === 'ocupada' && <span className="tenue" style={{ fontSize: 12 }}>Se libera con el check-out</span>}
              </div>))}
          </div>)}

      {cambio && <ModalServicio cambio={cambio} error={accion.error} ocupado={accion.ocupado}
                                alCerrar={() => setCambio(null)} alAceptar={(nota) => aplicar(cambio.cuarto, cambio.a, nota)} />}
    </>
  );
}

function ModalServicio({ cambio, error, ocupado, alCerrar, alAceptar }) {
  const [nota, setNota] = useState('');
  return (
    <Modal titulo={`Hab. ${cambio.cuarto.numero} → ${ESTADOS_HABITACION[cambio.a].texto}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" cargando={ocupado} onClick={() => alAceptar(nota)}>Guardar</Boton></>}>
      <div className="formulario">
        <Aviso error={error} />
        <Campo etiqueta="¿Qué pasó?" ayuda="Obligatorio (RN-25). Queda en el historial del cuarto.">
          <textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus placeholder="Ej. Fuga en la regadera" />
        </Campo>
      </div>
    </Modal>
  );
}
