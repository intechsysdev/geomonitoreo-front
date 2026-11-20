import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Hexagon, Link2, Menu, Radar, Route, Smartphone, X, type LucideIcon } from "lucide-react";
import { useSesion } from "../sesion/SesionContexto";
import { nombreRol } from "../sesion/roles";
import { useTema } from "../tema/Tema";
import { MarcaProducto } from "./Marca";
import { MenuUsuario } from "./MenuUsuario";

interface Entrada {
  a: string;
  nombre: string;
  Icono: LucideIcon;
  /** Solo para el administrador de la plataforma. */
  soloAdministrador?: boolean;
}

const GRUPOS: { titulo: string; entradas: Entrada[] }[] = [
  {
    titulo: "Operación",
    entradas: [
      { a: "/monitor", nombre: "Monitor en vivo", Icono: Radar },
      { a: "/dispositivos", nombre: "Dispositivos", Icono: Smartphone },
      { a: "/recorridos", nombre: "Recorridos", Icono: Route },
      { a: "/geocercas", nombre: "Geocercas", Icono: Hexagon },
    ],
  },
  {
    titulo: "Administración",
    entradas: [{ a: "/vinculos", nombre: "Vínculos con One", Icono: Link2, soloAdministrador: true }],
  },
];

/**
 * Marco de la consola, el mismo de WorkLog (AppShell): el panel con la marca, las secciones y, al
 * pie, el menú de la cuenta (empresa, tema y salida), y el contenido en todo lo demás (las
 * pantallas con mapa lo usan a sangre). Desde 901 px el panel va a la izquierda; por debajo es la
 * barra de arriba, y el botón lo despliega debajo de ella.
 */
export function Marco({ children }: { children: ReactNode }) {
  const { correo, sesion, empresaActiva, esAdministradorPlataforma, cambiarEmpresa, salir } = useSesion();
  const { oscuro, alternar } = useTema();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);

  const grupos = GRUPOS
    .map((g) => ({ ...g, entradas: g.entradas.filter((e) => !e.soloAdministrador || esAdministradorPlataforma) }))
    .filter((g) => g.entradas.length > 0);

  const rol = empresaActiva?.rol
    ? nombreRol(empresaActiva.rol)
    : esAdministradorPlataforma ? "Administrador" : null;
  const empresa = empresaActiva?.nombre ?? "Sin empresa";

  return (
    <div className="marco">
      <a href="#contenido" className="saltar">Saltar al contenido</a>

      <aside className="menu-lateral">
        <div className="menu-cabeza">
          <Link to="/monitor" className="menu-logo lugar-marca" aria-label="Track · INTECHSYS ONE" onClick={cerrarMenu}>
            <MarcaProducto />
          </Link>
          <button
            type="button"
            className="menu-boton"
            aria-expanded={menuAbierto}
            aria-controls="panel-nav"
            aria-label={menuAbierto ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setMenuAbierto((valor) => !valor)}
          >
            {menuAbierto ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>

        {/* En pantallas angostas el panel solo se ve desplegado; desde 901 px, siempre. */}
        <div id="panel-nav" className={menuAbierto ? "menu-cuerpo" : "menu-cuerpo menu-plegado"}>
          <nav className="menu-secciones" aria-label="Secciones">
            {grupos.map((g) => (
              <div key={g.titulo} className="menu-grupo">
                <p className="menu-titulo">{g.titulo}</p>
                <ul>
                  {g.entradas.map(({ a, nombre: rotulo, Icono }) => (
                    <li key={a}>
                      <NavLink to={a} className="menu-enlace" onClick={cerrarMenu}>
                        <Icono aria-hidden />
                        {rotulo}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="menu-pie">
            <MenuUsuario
              nombre={sesion?.nombre || correo || "Tu cuenta"}
              correo={correo}
              detalle={rol ? `${rol} · ${empresa}` : empresa}
              empresas={(sesion?.empresas ?? []).map((e) => ({ id: e.oneTenantId, nombre: e.nombre }))}
              empresaActiva={empresaActiva?.oneTenantId ?? null}
              alElegirEmpresa={(id) => {
                cambiarEmpresa(id);
                // Lo abierto (un equipo, una geocerca) es de la empresa anterior.
                if (pathname !== "/monitor") navigate(pathname, { replace: true });
              }}
              oscuro={oscuro}
              alAlternarTema={alternar}
              alSalir={salir}
            />
          </div>
        </div>
      </aside>

      <div id="contenido" tabIndex={-1} className="marco-contenido">{children}</div>
    </div>
  );
}
