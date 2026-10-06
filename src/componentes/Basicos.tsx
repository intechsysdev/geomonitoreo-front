import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { bateriaBaja, estadoDe, NOMBRE_ESTADO } from "../formato";
import type { Equipo } from "../api/flota";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      <span className="giro" aria-hidden />
      {texto}
    </div>
  );
}

const ICONOS = { info: Info, error: XCircle, exito: CheckCircle2, alerta: AlertTriangle };

export function Aviso({ tipo = "info", children }: { tipo?: keyof typeof ICONOS; children: ReactNode }) {
  const Icono = ICONOS[tipo];
  return (
    <div className="aviso" data-tipo={tipo} role={tipo === "error" ? "alert" : undefined}>
      <Icono aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function PuntoEstado({ equipo }: { equipo: Pick<Equipo, "enLinea" | "ultimoReporte"> }) {
  const estado = estadoDe(equipo);
  return <span className="punto-estado" data-estado={estado} title={NOMBRE_ESTADO[estado]} />;
}

export function Bateria({ equipo }: { equipo: Pick<Equipo, "bateria" | "cargando"> }) {
  if (equipo.bateria === null) return <span className="suave chico">—</span>;

  const tono = bateriaBaja(equipo) ? "peligro" : equipo.bateria <= 40 ? "aviso" : undefined;
  return (
    <span
      className="bateria"
      data-tono={tono}
      style={{ "--nivel": `${equipo.bateria}%` } as React.CSSProperties}
      title={equipo.cargando ? "Cargando" : undefined}
    >
      {equipo.bateria}%{equipo.cargando ? " ⚡" : ""}
    </span>
  );
}

/**
 * Diálogo modal nativo: queda en la capa superior, atrapa el foco y se cierra con Esc o con un
 * clic afuera (closedby="any"; donde el navegador todavía no lo entiende, se hace a mano).
 */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  children,
  acciones,
  ancho,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  acciones?: ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  useEffect(() => {
    const dialogo = ref.current;
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
    <dialog
      ref={ref}
      className="dialogo"
      // closedby todavía no está en los tipos de React.
      {...{ closedby: "any" }}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      style={ancho ? { inlineSize: `min(${ancho}, calc(100vw - 2rem))` } : undefined}
    >
      {abierto && (
        <>
          <div className="dialogo-cuerpo">
            <h2 id={idTitulo}>{titulo}</h2>
            {children}
          </div>
          {acciones && <div className="acciones">{acciones}</div>}
        </>
      )}
    </dialog>
  );
}
