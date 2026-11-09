import { useEffect, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { useConsulta } from '../hooks/useConsulta.js';
import { useAccion } from '../hooks/useAccion.js';
import { pmsApi } from '../services/pmsApi.js';
import { dinero, fechaCorta, hoyISO, noches } from '../utils/formato.js';
import { Aviso, Boton, Campo, Cargando, Chip, Encabezado, Modal, Vacio } from '../components/comunes.jsx';

/** Datos del hotel, precios base y temporadas. Solo administración y gerencia (RN-72). */
export default function Configuracion() {
  const { hotelId, hotel, puede } = useSesion();
  const tarifas = useConsulta(() => pmsApi.tarifas(hotelId), [hotelId]);
  const [nueva, setNueva] = useState(null);          // tipo de habitación para la nueva temporada
  const accion = useAccion();
  const hoy = hoyISO();

  const cambiarPrecio = async (tipo) => {
    const valor = window.prompt(`Nuevo precio base por noche para "${tipo.nombre}" (solo aplica a reservaciones nuevas):`, tipo.precioBase);
    if (valor === null) return;
    const { ok } = await accion.ejecutar(() => pmsApi.cambiarPrecioBase(hotelId, tipo.id, valor));
    if (ok) tarifas.recargar();
  };
  const eliminar = async (t) => {
    if (!window.confirm(`¿Eliminar la temporada "${t.nombre}"?`)) return;
    const { ok } = await accion.ejecutar(() => pmsApi.eliminarTemporada(hotelId, t.id));
    if (ok) tarifas.recargar();
  };

  return (
    <>
      <Encabezado titulo="Hotel y tarifas" subtitulo={hotel?.nombre} />
      {puede('hotel:configurar') && hotel && <DatosHotel key={hotel.id} hotel={hotel} />}

      <section className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Precios por tipo de habitación</h2>
          <span className="suave" style={{ fontSize: 13 }}>El sistema cobra cada noche con la temporada que le toque (RN-61)</span>
        </div>
        <div className="tarjeta-cuerpo">
          <Aviso error={accion.error} />
          {!tarifas.datos ? <Cargando /> : tarifas.datos.length === 0 ? <Vacio>Este hotel no tiene tipos de habitación.</Vacio> : (
            <div className="tipos-tarifa">
              {tarifas.datos.map((tipo) => (
                <article key={tipo.id} className="tipo-tarifa">
                  <header>
                    <div>
                      <h3>{tipo.nombre}</h3>
                      <span className="suave" style={{ fontSize: 12.5 }}>{tipo.habitaciones} hab. · hasta {tipo.capacidadAdultos} adultos{tipo.capacidadNinos > 0 && ` y ${tipo.capacidadNinos} niños`}</span>
                    </div>
                    <div className="derecha">
                      <div className="precio num">{dinero(tipo.precioBase)}</div>
                      <span className="tenue" style={{ fontSize: 12 }}>precio base / noche</span>
                    </div>
                  </header>
                  <ul className="lista">
                    {tipo.temporadas.map((t) => {
                      const estado = t.fechaFin <= hoy ? ['gris', 'Terminó'] : t.fechaInicio <= hoy ? ['verde', 'Vigente'] : ['azul', 'Próxima'];
                      return (
                        <li key={t.id}>
                          <div>
                            <div className="principal">{t.nombre} <Chip tono={estado[0]}>{estado[1]}</Chip></div>
                            <div className="secundario">{fechaCorta(t.fechaInicio)} al {fechaCorta(t.fechaFin)} · {noches(t.fechaInicio, t.fechaFin)} noches</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <b className="num">{dinero(t.precioNoche)}</b>
                            {t.fechaInicio > hoy && <Boton chico onClick={() => eliminar(t)} aria-label={`Eliminar ${t.nombre}`}>Eliminar</Boton>}
                          </div>
                        </li>);
                    })}
                    {tipo.temporadas.length === 0 && <li className="tenue">Sin temporadas: siempre se cobra el precio base.</li>}
                  </ul>
                  <footer className="botones">
                    <Boton chico onClick={() => cambiarPrecio(tipo)}>Cambiar precio base</Boton>
                    <Boton chico tipo="primario" onClick={() => setNueva(tipo)}>+ Temporada</Boton>
                  </footer>
                </article>))}
            </div>)}
        </div>
      </section>

      {nueva && <ModalTemporada tipo={nueva} hotelId={hotelId} alCerrar={() => setNueva(null)}
                                alTerminar={() => { setNueva(null); tarifas.recargar(); }} />}
    </>
  );
}

function DatosHotel({ hotel }) {
  const { hotelId, recargarHoteles } = useSesion();
  const inicial = () => ({ telefono: hotel.telefono ?? '', email: hotel.email ?? '', direccion: hotel.direccion ?? '',
    horaCheckIn: hotel.horaCheckIn ?? '15:00', horaCheckOut: hotel.horaCheckOut ?? '12:00', telegramChatId: hotel.telegramChatId ?? '' });
  const [d, setD] = useState(inicial);
  const [guardado, setGuardado] = useState(false);
  const accion = useAccion();
  useEffect(() => setGuardado(false), [d]);
  const cambiar = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    const { ok } = await accion.ejecutar(() => pmsApi.configurarHotel(hotelId, d));
    if (ok) { await recargarHoteles(); setGuardado(true); }
  };
  return (
    <section className="tarjeta" style={{ marginBottom: 16 }}>
      <div className="tarjeta-cab"><h2>Datos del hotel</h2><span className="suave" style={{ fontSize: 13 }}>{hotel.ciudad}</span></div>
      <form className="tarjeta-cuerpo formulario" onSubmit={guardar}>
        <Aviso error={accion.error} />
        {guardado && <Aviso tipo="ok">Cambios guardados.</Aviso>}
        <div className="fila">
          <Campo etiqueta="Teléfono"><input value={d.telefono} onChange={cambiar('telefono')} inputMode="tel" /></Campo>
          <Campo etiqueta="Correo"><input type="email" value={d.email} onChange={cambiar('email')} /></Campo>
        </div>
        <Campo etiqueta="Dirección"><input value={d.direccion} onChange={cambiar('direccion')} /></Campo>
        <div className="fila">
          <Campo etiqueta="Hora de entrada (check-in)"><input type="time" value={d.horaCheckIn} onChange={cambiar('horaCheckIn')} required /></Campo>
          <Campo etiqueta="Hora de salida (antes de la entrada)"><input type="time" value={d.horaCheckOut} onChange={cambiar('horaCheckOut')} required /></Campo>
        </div>
        <Campo etiqueta="Chat de Telegram de recepción" ayuda="Grupo donde llegan el resumen de las 8:00 y los avisos. Agrega el bot al grupo y escribe /miid para conocer el número.">
          <input value={d.telegramChatId} onChange={cambiar('telegramChatId')} placeholder="-1001234567890" />
        </Campo>
        <div className="botones"><Boton tipo="primario" type="submit" cargando={accion.ocupado}>Guardar datos</Boton></div>
      </form>
    </section>
  );
}

function ModalTemporada({ tipo, hotelId, alCerrar, alTerminar }) {
  const [t, setT] = useState({ nombre: '', fechaInicio: '', fechaFin: '', precioNoche: '' });
  const accion = useAccion();
  const cambiar = (k) => (e) => setT({ ...t, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    const { ok } = await accion.ejecutar(() => pmsApi.crearTemporada(hotelId, { ...t, tipoId: tipo.id }));
    if (ok) alTerminar();
  };
  return (
    <Modal titulo={`Nueva temporada · ${tipo.nombre}`} alCerrar={alCerrar}
           pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton tipo="primario" form="form-temporada" type="submit" cargando={accion.ocupado}>Guardar</Boton></>}>
      <form id="form-temporada" className="formulario" onSubmit={guardar}>
        <Aviso error={accion.error} />
        <Campo etiqueta="Nombre"><input value={t.nombre} onChange={cambiar('nombre')} placeholder="Semana Santa 2027" required autoFocus /></Campo>
        <div className="fila">
          <Campo etiqueta="Desde (primera noche)"><input type="date" value={t.fechaInicio} onChange={cambiar('fechaInicio')} required /></Campo>
          <Campo etiqueta="Hasta (no incluida)" ayuda="Igual que una salida: esa noche ya no lleva el precio especial"><input type="date" value={t.fechaFin} onChange={cambiar('fechaFin')} required /></Campo>
        </div>
        <Campo etiqueta="Precio por noche" ayuda={`Precio base actual: ${dinero(tipo.precioBase)}`}>
          <input inputMode="decimal" value={t.precioNoche} onChange={cambiar('precioNoche')} placeholder="1500" required />
        </Campo>
      </form>
    </Modal>
  );
}
