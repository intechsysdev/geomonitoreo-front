import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Hexagon, Link2, LogOut, Menu, Moon, Radar, Route, Smartphone, Sun, X, type LucideIcon } from "lucide-react";
import { useSesion } from "../sesion/SesionContexto";
import { useTema } from "../tema/Tema";
import { MarcaProducto } from "./Marca";

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

/** La empresa activa, bajo la marca: con varias, el selector para cambiarla; con una, su nombre. */
function SelectorEmpresa() {
  const { sesion, empresaActiva, cambiarEmpresa } = useSesion();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!sesion) return null;
  if (sesion.empresas.length < 2) {
    return empresaActiva && <p className="menu-empresa" title={empresaActiva.nombre}>{empresaActiva.nombre}</p>;
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

/**
 * El menú: marca y empresa, las secciones y, al pie, el tema y la cuenta. Es el mismo en el panel
 * lateral y en el cajón de las pantallas angostas; en el cajón, `alCerrar` agrega el botón de
 * cerrar y lo cierra al elegir una entrada.
 */
function MenuLateral({ alCerrar }: { alCerrar?: () => void }) {
  const { correo, sesion, esAdministradorPlataforma, salir } = useSesion();
  const { oscuro, alternar } = useTema();
  const nombre = sesion?.nombre ?? null;
  const inicial = (nombre ?? correo ?? "?").trim().charAt(0).toUpperCase();

  const grupos = GRUPOS
    .map((g) => ({ ...g, entradas: g.entradas.filter((e) => !e.soloAdministrador || esAdministradorPlataforma) }))
    .filter((g) => g.entradas.length > 0);

  return (
    <div className="menu-contenido">
      <div className="menu-arriba">
        <div className="menu-marca">
          <Link to="/monitor" className="menu-logo lugar-marca" aria-label="Track · INTECHSYS ONE" onClick={alCerrar}>
            <MarcaProducto />
          </Link>
          {alCerrar && (
            <button type="button" className="boton fantasma chico icono menu-cerrar" aria-label="Cerrar menú" onClick={alCerrar}>
              <X aria-hidden />
            </button>
          )}
        </div>
        <SelectorEmpresa />
      </div>

      <nav className="menu-secciones" aria-label="Secciones">
        {grupos.map((g) => (
          <div key={g.titulo} className="menu-grupo">
            {/* Con un solo grupo el título sobra: solo el administrador ve dos. */}
            {grupos.length > 1 && <p className="menu-titulo">{g.titulo}</p>}
            <ul>
              {g.entradas.map(({ a, nombre: rotulo, Icono }) => (
                <li key={a}>
                  <NavLink to={a} className="menu-enlace" onClick={alCerrar}>
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
        <button type="button" className="menu-enlace" onClick={alternar}>
          {oscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {oscuro ? "Usar tema claro" : "Usar tema oscuro"}
        </button>
        <div className="menu-usuario">
          <span className="avatar" aria-hidden>{inicial}</span>
          <span className="menu-usuario-texto">
            {nombre && <strong title={nombre}>{nombre}</strong>}
            {correo && <span title={correo}>{correo}</span>}
          </span>
        </div>
        <button type="button" className="menu-enlace" onClick={salir}>
          <LogOut aria-hidden /> Salir
        </button>
      </div>
    </div>
  );
}

/**
 * Marco de la consola: el menú en un panel a la izquierda y el contenido en todo lo demás (las
 * pantallas con mapa lo usan a sangre). En pantallas angostas el menú va en un cajón que se abre
 * desde la barra de arriba.
 */
export function Marco({ children }: { children: ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cajon = useRef<HTMLDialogElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  const cerrarMenu = useCallback(() => {
    cajon.current?.close();
  }, []);

  const abrirMenu = () => {
    const dialogo = cajon.current;
    if (!dialogo || dialogo.open) return;
    dialogo.showModal();
    setMenuAbierto(true);
    // El foco va a la primera entrada, no al logo.
    dialogo.querySelector<HTMLElement>(".menu-secciones .menu-enlace")?.focus();
  };

  // Al cambiar de pantalla o al pasar a pantalla ancha (allí el menú es el panel), el cajón se cierra.
  useEffect(() => cerrarMenu(), [pathname, cerrarMenu]);
  useEffect(() => {
    const ancha = window.matchMedia("(width >= 1024px)");
    const cambio = () => {
      if (ancha.matches) cerrarMenu();
    };
    ancha.addEventListener("change", cambio);
    return () => ancha.removeEventListener("change", cambio);
  }, [cerrarMenu]);

  // Tocar el fondo lo cierra: closedby="any"; donde el navegador todavía no lo entiende, a mano.
  useEffect(() => {
    const dialogo = cajon.current;
    if (!dialogo || "closedBy" in HTMLDialogElement.prototype) return;

    const clic = (evento: MouseEvent) => {
      if (evento.target !== dialogo) return;
      const r = dialogo.getBoundingClientRect();
      const dentro = r.top <= evento.clientY && evento.clientY <= r.bottom && r.left <= evento.clientX && evento.clientX <= r.right;
      if (!dentro) dialogo.close();
    };

    dialogo.addEventListener("click", clic);
    return () => dialogo.removeEventListener("click", clic);
  }, []);

  return (
    <div className="marco">
      <aside className="menu-lateral">
        <MenuLateral />
      </aside>

      <header className="barra-movil">
        <button
          ref={botonMenu}
          type="button"
          className="boton-menu"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuAbierto}
          aria-controls="cajon-menu"
          onClick={() => (menuAbierto ? cerrarMenu() : abrirMenu())}
        >
          {menuAbierto ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
        <div className="lugar-marca">
          <MarcaProducto />
        </div>
      </header>

      <dialog
        ref={cajon}
        id="cajon-menu"
        className="cajon-menu"
        aria-label="Menú"
        // closedby todavía no está en los tipos de React.
        {...{ closedby: "any" }}
        onClose={() => {
          setMenuAbierto(false);
          botonMenu.current?.focus();
        }}
      >
        <MenuLateral alCerrar={cerrarMenu} />
      </dialog>

      <div className="marco-contenido">{children}</div>
    </div>
  );
}
