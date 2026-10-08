import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Hexagon, Link2, LogOut, Moon, Radar, Route, Smartphone, Sun } from "lucide-react";
import { useSesion } from "../sesion/SesionContexto";
import { useTema } from "../tema/Tema";

const SECCIONES = [
  { a: "/monitor", nombre: "Monitor en vivo", Icono: Radar },
  { a: "/dispositivos", nombre: "Dispositivos", Icono: Smartphone },
  { a: "/recorridos", nombre: "Recorridos", Icono: Route },
  { a: "/geocercas", nombre: "Geocercas", Icono: Hexagon },
];

export function Logo({ tamano = 36 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e51e4a" />
          <stop offset="1" stopColor="#751326" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="4.5" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
      <path d="M16 16 L24 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="logo-barrido" />
      <circle cx="16" cy="16" r="2" fill="#fff" />
    </svg>
  );
}

function SelectorEmpresa() {
  const { sesion, empresaActiva, cambiarEmpresa } = useSesion();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!sesion || sesion.empresas.length < 2) {
    return empresaActiva ? <span className="empresa-fija">{empresaActiva.nombre}</span> : null;
  }

  return (
    <select
      className="campo selector-empresa"
      aria-label="Empresa"
      value={empresaActiva?.oneTenantId ?? ""}
      onChange={(e) => {
        cambiarEmpresa(e.target.value);
        // Lo abierto (un equipo, una geocerca) es de la empresa anterior.
        if (pathname !== "/monitor") navigate(pathname, { replace: true });
      }}
    >
      <option value="" disabled>Elige una empresa</option>
      {sesion.empresas.map((e) => (
        <option key={e.oneTenantId} value={e.oneTenantId}>{e.nombre}</option>
      ))}
    </select>
  );
}

function MenuUsuario() {
  const { correo, sesion, salir } = useSesion();
  const inicial = (sesion?.nombre ?? correo ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <button type="button" className="avatar" popoverTarget="menu-usuario" aria-label="Cuenta">
        {inicial}
      </button>
      <div id="menu-usuario" popover="auto" className="menu-usuario vidrio">
        <div className="menu-usuario-cabeza">
          <strong>{sesion?.nombre ?? "Tu cuenta"}</strong>
          <span className="suave chico">{correo}</span>
        </div>
        <button type="button" className="boton fantasma ancho" onClick={salir}>
          <LogOut aria-hidden /> Salir
        </button>
      </div>
    </>
  );
}

/**
 * Marco de la consola: riel de navegación a la izquierda y, arriba, empresa y cuenta. El
 * contenido ocupa todo lo demás; las pantallas con mapa lo usan a sangre.
 */
export function Marco({ children }: { children: ReactNode }) {
  const { esAdministradorPlataforma } = useSesion();
  const { oscuro, alternar } = useTema();

  return (
    <div className="marco">
      <nav className="riel" aria-label="Secciones">
        <NavLink to="/monitor" className="riel-logo" aria-label="Geomonitoreo">
          <Logo />
        </NavLink>

        <ul className="riel-lista">
          {SECCIONES.map(({ a, nombre, Icono }) => (
            <li key={a}>
              <NavLink to={a} className="riel-enlace" aria-label={nombre} data-titulo={nombre}>
                <Icono aria-hidden />
              </NavLink>
            </li>
          ))}
          {esAdministradorPlataforma && (
            <li>
              <NavLink to="/vinculos" className="riel-enlace" aria-label="Vínculos con One" data-titulo="Vínculos con One">
                <Link2 aria-hidden />
              </NavLink>
            </li>
          )}
        </ul>

        <div className="riel-pie">
          <button
            type="button"
            className="riel-enlace"
            onClick={alternar}
            aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
            data-titulo={oscuro ? "Tema claro" : "Tema oscuro"}
          >
            {oscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </button>
          <MenuUsuario />
        </div>
      </nav>

      <div className="marco-contenido">
        <header className="barra-superior">
          <SelectorEmpresa />
        </header>
        {children}
      </div>
    </div>
  );
}
