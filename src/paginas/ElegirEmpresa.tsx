import { Building2, ChevronRight, LogOut } from "lucide-react";
import type { EmpresaAccesible } from "../api/plataforma";
import { useSesion } from "../sesion/SesionContexto";
import { MarcoPaso } from "../componentes/MarcoPaso";

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

  return (
    <MarcoPaso
      enfocarTitulo
      titulo="¿Con qué empresa vas a trabajar?"
      descripcion="Tienes acceso a Track en varias empresas. Puedes cambiar luego desde tu menú."
    >
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

      <button type="button" className="boton fantasma" onClick={salir}>
        <LogOut aria-hidden /> Salir
      </button>
    </MarcoPaso>
  );
}
