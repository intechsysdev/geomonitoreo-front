import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Hexagon, LogIn, Moon, Radar, Route, Sun } from "lucide-react";
import { useSesion } from "../sesion/SesionContexto";
import { useTema } from "../tema/Tema";
import { ssoDisponible } from "../api/sso";
import { Aviso } from "../componentes/Basicos";
import { Logo } from "../componentes/Marco";

const PUNTOS = [
  { x: 22, y: 30, d: 0 }, { x: 64, y: 22, d: 1.2 }, { x: 78, y: 58, d: 2.1 }, { x: 40, y: 70, d: 0.6 },
  { x: 55, y: 44, d: 1.7 }, { x: 30, y: 52, d: 2.6 }, { x: 70, y: 80, d: 0.9 },
];

export function Login() {
  const { entrar } = useSesion();
  const { oscuro, alternar } = useTema();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await entrar(correo.trim(), clave);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ingreso">
      <section className="ingreso-escena" aria-hidden>
        <div className="radar">
          <div className="radar-barrido" />
          {PUNTOS.map((p, i) => (
            <span key={i} className="radar-punto" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s` }} />
          ))}
        </div>
        <div className="ingreso-mensaje">
          <h2>Tu flota, en el mapa y en vivo.</h2>
          <ul>
            <li><Radar /> Estado y ubicación de cada equipo de MobiControl</li>
            <li><Route /> Recorridos con paradas, velocidad y reproducción</li>
            <li><Hexagon /> Geocercas: quién está dentro de cada zona</li>
          </ul>
        </div>
      </section>

      <main className="ingreso-panel">
        <div className="ingreso-arriba">
          <span className="marca-texto"><Logo tamano={30} /> Geomonitoreo</span>
          <button type="button" className="boton fantasma icono" onClick={alternar} aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}>
            {oscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </button>
        </div>

        <form className="ingreso-formulario" onSubmit={enviar}>
          <div>
            <h1>Iniciar sesión</h1>
            <p className="suave">Con tu cuenta de Intechsys One.</p>
          </div>

          {ssoDisponible() && (
            <>
              <Link to="/sso?cuenta=elegir" className="boton primario ancho grande">
                <LogIn aria-hidden /> Entrar con One
              </Link>
              <div className="separador"><span>o con tu correo</span></div>
            </>
          )}

          {error && <Aviso tipo="error">{error}</Aviso>}

          <label className="etiqueta">
            Correo
            <input className="campo" type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
          <label className="etiqueta">
            Contraseña
            <input className="campo" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>

          <button type="submit" className="boton ancho grande" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="suave chico ingreso-pie">Intechsys · Geomonitoreo de dispositivos</p>
      </main>
    </div>
  );
}
