import { useEffect, useRef } from "react";
import { Building2, ChevronRight, LogOut } from "lucide-react";
import type { EmpresaAccesible } from "../api/plataforma";
import { useSesion } from "../sesion/SesionContexto";
import { Marca } from "../componentes/Marco";

/** One manda el rol con el nombre de su enumeración; aquí se muestra como lo nombra One. */
const ROLES: Record<string, string> = {
  Owner: "Propietario",
  Admin: "Administrador",
  Member: "Miembro",
  Viewer: "Observador",
};

/**
 * Lo que ayuda a distinguir una empresa de otra con nombre parecido: el rol que tiene en ella o,
 * si no es miembro (el administrador de plataforma las ve todas), su identificador en One.
 */
function detalle(empresa: EmpresaAccesible): string | null {
  if (empresa.rol) return `Rol en ONE: ${ROLES[empresa.rol] ?? empresa.rol}`;
  return empresa.slug || null;
}

/**
 * Con varias empresas y ninguna elegida (o la guardada ya no está a su alcance) se pregunta con
 * cuál trabajar antes de entrar a la consola: elegir una a ciegas mostraría la flota de otra.
 * Luego se cambia desde el selector del menú.
 */
export function ElegirEmpresa() {
  const { sesion, cambiarEmpresa, salir } = useSesion();
  const titulo = useRef<HTMLHeadingElement>(null);

  // El lector de pantalla anuncia la pantalla nueva y Tab sigue con la primera empresa.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <main className="pantalla-paso">
      <div className="eleccion">
        <span className="marca-texto">
          {/* El logo de la entrada: horizontal si hay lugar; si no, la compacta. El CSS elige. */}
          <Marca pieza="logo" className="marca-ancha" />
          <Marca pieza="marca" className="marca-compacta" />
          Geomonitoreo
        </span>

        <section className="eleccion-tarjeta tarjeta" aria-labelledby="eleccion-titulo">
          <div className="eleccion-cabeza">
            <h1 id="eleccion-titulo" ref={titulo} tabIndex={-1}>¿Con qué empresa vas a trabajar?</h1>
            <p className="suave">Tienes acceso a Geomonitoreo en varias empresas. Puedes cambiarla luego desde el menú.</p>
          </div>

          <ul className="lista-empresas">
            {(sesion?.empresas ?? []).map((empresa) => {
              const extra = detalle(empresa);
              return (
                <li key={empresa.oneTenantId}>
                  <button type="button" className="empresa-opcion" onClick={() => cambiarEmpresa(empresa.oneTenantId)}>
                    <span className="empresa-icono" aria-hidden><Building2 /></span>
                    <span className="empresa-texto">
                      <span className="empresa-nombre" title={empresa.nombre}>{empresa.nombre}</span>
                      {extra && <span className="empresa-detalle">{extra}</span>}
                    </span>
                    <ChevronRight className="empresa-flecha" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <button type="button" className="boton fantasma eleccion-salir" onClick={salir}>
            <LogOut aria-hidden /> Salir
          </button>
        </section>

        <p className="eleccion-pie">INTECHSYS ONE · Geomonitoreo</p>
      </div>
    </main>
  );
}
