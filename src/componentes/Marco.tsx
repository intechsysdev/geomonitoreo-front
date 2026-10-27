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

/** Proporciones de los SVG de la marca, para que el lugar quede reservado antes de que carguen. */
const PIEZAS = {
  /** Horizontal, sin lema: para la pantalla de entrada (no menos de 360 px de ancho). */
  logo: { ancho: 942, alto: 342 },
  /** Compacta (isotipo + "one"), vertical: para el riel y los espacios chicos. */
  marca: { ancho: 545, alto: 757 },
};

/**
 * Marca oficial de INTECHSYS ONE. Va en sus dos variantes y el CSS muestra la del tema (el del
 * sistema o el fijado en data-tema), así no hay que esperar a React para elegirla. Es una
 * imagen y no SVG en línea: los ids internos de los archivos chocarían entre sí.
 */
export function Marca({ pieza, alt = "INTECHSYS ONE", className }: { pieza: keyof typeof PIEZAS; alt?: string; className?: string }) {
  const { ancho, alto } = PIEZAS[pieza];
  return (
    <span className={className ? `marca-oficial ${className}` : "marca-oficial"}>
      <img src={`/marca/${pieza}.svg`} width={ancho} height={alto} alt={alt} className="variante-clara" />
      <img src={`/marca/${pieza}-oscuro.svg`} width={ancho} height={alto} alt={alt} className="variante-oscura" />
    </span>
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
        <NavLink to="/monitor" className="riel-logo" aria-label="Geomonitoreo · INTECHSYS ONE">
          <Marca pieza="marca" alt="" />
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
