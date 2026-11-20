import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
 * El menú, el mismo de WorkLog: la marca, las secciones y, al pie, el menú de la cuenta (empresa,
 * tema y salida). Es el mismo en el panel lateral y en el cajón de las pantallas angostas; en el
 * cajón, `alCerrar` agrega el botón de cerrar y lo cierra al elegir una entrada.
 */
function MenuLateral({ alCerrar }: { alCerrar?: () => void }) {
  const { correo, sesion, empresaActiva, esAdministradorPlataforma, cambiarEmpresa, salir } = useSesion();
  const { oscuro, alternar } = useTema();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const grupos = GRUPOS
    .map((g) => ({ ...g, entradas: g.entradas.filter((e) => !e.soloAdministrador || esAdministradorPlataforma) }))
    .filter((g) => g.entradas.length > 0);

  const rol = empresaActiva?.rol
    ? nombreRol(empresaActiva.rol)
    : esAdministradorPlataforma ? "Administrador de plataforma" : null;
  const empresa = empresaActiva?.nombre ?? "Sin empresa";

  return (
    <div className="menu-contenido">
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

      <div className="menu-cuerpo">
        <nav className="menu-secciones" aria-label="Secciones">
          {grupos.map((g) => (
            <div key={g.titulo} className="menu-grupo">
              <p className="menu-titulo">{g.titulo}</p>
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
