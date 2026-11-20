import { Building2, ChevronRight, LogOut } from "lucide-react";
import type { EmpresaAccesible } from "../api/plataforma";
import { useSesion } from "../sesion/SesionContexto";
import { nombreRol } from "../sesion/roles";
import { MarcoPaso } from "../componentes/MarcoPaso";

/**
 * Lo que ayuda a distinguir una empresa de otra con nombre parecido: el rol que tiene en ella o,
 * si no es miembro (el administrador de plataforma las ve todas), su identificador en One.
 */
function detalle(empresa: EmpresaAccesible): string | null {
  if (empresa.rol) return `Rol en ONE: ${nombreRol(empresa.rol)}`;
  return empresa.slug || null;
}

/**
 * Con varias empresas y ninguna elegida (o la guardada ya no está a su alcance) se pregunta con
 * cuál trabajar antes de entrar a la consola: elegir una a ciegas mostraría la flota de otra.
 * Luego se cambia desde el menú de la cuenta.
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
