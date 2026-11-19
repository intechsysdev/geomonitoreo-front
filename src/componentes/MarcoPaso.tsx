import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { MarcaProducto } from "./Marca";

/**
 * Marco de las pantallas sin sesión, fuera de la consola (login, elegir empresa, entrar con One,
 * errores al entrar): la marca arriba y una tarjeta centrada, como en WorkLog. Con `enfocarTitulo`
 * el foco va al título al mostrarse: el lector de pantalla anuncia la pantalla nueva y Tab sigue
 * con lo de adentro.
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

/** Aviso de error en la tarjeta, como el InlineMessage de WorkLog: ámbar, con el triángulo. */
export function AvisoPaso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso-paso" role="alert">
      <AlertTriangle aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Paso en curso (conectando con One, entrando): el título dice qué pasa y abajo, la espera. */
export function PasoEnCurso({ titulo }: { titulo: string }) {
  return (
    <MarcoPaso titulo={titulo}>
      <div className="paso-espera" role="status">
        <Loader2 aria-hidden />
        Un momento, por favor.
      </div>
    </MarcoPaso>
  );
}
