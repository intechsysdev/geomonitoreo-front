import { useEffect, useRef, type ReactNode } from "react";
import { MarcaProducto } from "./Marca";

/**
 * Marco de las pantallas de paso, fuera de la consola (elegir empresa, errores al entrar): la
 * marca arriba y una tarjeta centrada, como en WorkLog. Con `enfocarTitulo` el foco va al título
 * al mostrarse: el lector de pantalla anuncia la pantalla nueva y Tab sigue con lo de adentro.
 */
export function MarcoPaso({
  titulo,
  descripcion,
  enfocarTitulo = false,
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  enfocarTitulo?: boolean;
  children: ReactNode;
}) {
  const encabezado = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (enfocarTitulo) encabezado.current?.focus();
  }, [enfocarTitulo]);

  return (
    <main className="marco-paso">
      <div className="paso-columna">
        <MarcaProducto className="paso-marca" />
        <section className="paso-tarjeta" aria-labelledby="paso-titulo">
          <div className="paso-cabeza">
            <h1 id="paso-titulo" ref={encabezado} tabIndex={enfocarTitulo ? -1 : undefined}>{titulo}</h1>
            {descripcion && <p>{descripcion}</p>}
          </div>
          {children}
        </section>
        <p className="paso-pie">INTECHSYS ONE · Track</p>
      </div>
    </main>
  );
}
