import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Esquema = "light" | "dark";

interface Contexto {
  /** El tema que se ve: el del sistema, o el que el usuario fijó. */
  oscuro: boolean;
  /** Si el usuario fijó uno distinto al del sistema. */
  fijado: boolean;
  /** Dos estados, no tres: el del sistema, o fijar el contrario. */
  alternar: () => void;
}

const CLAVE = "geo.tema";
const TemaContexto = createContext<Contexto | null>(null);

function leerFijado(): Esquema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "light" || valor === "dark" ? valor : null;
  } catch {
    return null;
  }
}

const consultaOscuro = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Tema claro u oscuro. Por defecto, el del sistema (y lo sigue si cambia). Fijar uno es un ajuste
 * de comodidad de este sitio: queda guardado y no se recalcula si el sistema cambia después.
 */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [fijado, setFijado] = useState<Esquema | null>(leerFijado);
  const [sistemaOscuro, setSistemaOscuro] = useState(() => consultaOscuro().matches);

  useEffect(() => {
    const consulta = consultaOscuro();
    const cambio = () => setSistemaOscuro(consulta.matches);
    consulta.addEventListener("change", cambio);
    return () => consulta.removeEventListener("change", cambio);
  }, []);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (meta) meta.content = fijado ?? "light dark";

    if (fijado) document.documentElement.dataset.tema = fijado;
    else delete document.documentElement.dataset.tema;

    try {
      if (fijado) localStorage.setItem(CLAVE, fijado);
      else localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento, el tema dura lo que la pestaña */
    }
  }, [fijado]);

  const alternar = useCallback(() => {
    setFijado((actual) => (actual ? null : sistemaOscuro ? "light" : "dark"));
  }, [sistemaOscuro]);

  const valor = useMemo<Contexto>(
    () => ({ oscuro: fijado ? fijado === "dark" : sistemaOscuro, fijado: fijado !== null, alternar }),
    [fijado, sistemaOscuro, alternar],
  );

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): Contexto {
  const contexto = useContext(TemaContexto);
  if (!contexto) throw new Error("useTema debe usarse dentro de ProveedorTema.");
  return contexto;
}
