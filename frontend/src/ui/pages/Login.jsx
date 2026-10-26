import { useState } from 'react';
import { useSesion } from '../../application/SesionContext.jsx';
import { useAccion } from '../../application/hooks/useAccion.js';
import { Aviso, Boton, Campo } from '../components/comunes.jsx';

const DEMO = ['recepcion@losarcos.mx', 'limpieza@losarcos.mx', 'gerente@boutiquecanon.mx', 'admin@pms.local'];

export default function Login() {
  const { iniciarSesion, aviso } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { ocupado, error, ejecutar } = useAccion();

  const entrar = (e) => { e.preventDefault(); ejecutar(() => iniciarSesion(email, password)); };

  return (
    <div className="pantalla-login">
      <section className="login-arte">
        <div className="marca" style={{ padding: 0 }}><span>🏨</span><div>PMS Hotelero<small style={{ color: '#a9c4bf' }}>Boutique y posadas</small></div></div>
        <div>
          <h1>Sin agendas de papel. Sin sobreventas.</h1>
          <p>Reservaciones, huéspedes, habitaciones y cobros de tu hotel o posada en Tuxtla y San Cristóbal, en un solo lugar.</p>
        </div>
        <small style={{ color: '#8fb0aa' }}>Proyecto Integrador · Turismo</small>
      </section>
      <section className="login-form">
        <form onSubmit={entrar}>
          <div><h2 style={{ fontSize: 22 }}>Iniciar sesión</h2><p className="suave" style={{ margin: '4px 0 0' }}>Entra con tu correo del hotel.</p></div>
          {aviso && <Aviso>{aviso}</Aviso>}
          <Aviso error={error} />
          <Campo etiqueta="Correo">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Campo>
          <Boton tipo="primario" bloque cargando={ocupado} type="submit">Entrar</Boton>
          <div className="demo">
            <b>Usuarios de prueba</b> (contraseña <span className="mono">Demo1234</span>):<br />
            {DEMO.map((d, i) => <span key={d}>{i > 0 && ' · '}<button type="button" onClick={() => { setEmail(d); setPassword('Demo1234'); }}>{d.split('@')[0]}</button></span>)}
          </div>
        </form>
      </section>
    </div>
  );
}
