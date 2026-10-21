import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useConPausa, useFlota } from "../api/consultas";
import type { Equipo } from "../api/flota";
import { PuntoEstado } from "./Basicos";

/**
 * Elegir un equipo buscándolo en MobiControl. Con miles de equipos no cabe un desplegable con
 * todos: se escribe parte del nombre, modelo o serial y la consola devuelve los que coinciden.
 * Sin texto muestra los primeros por nombre.
 */
export function SelectorEquipo({ etiqueta, valor, nombreValor, alElegir, soloConGps = false }: {
  etiqueta: string;
  /** DeviceId elegido, o "" si ninguno. */
  valor: string;
  /** Cómo mostrar el elegido (puede no estar entre los resultados de la búsqueda). */
  nombreValor: string | null;
  alElegir: (deviceId: string) => void;
  /** Ocultar los equipos sin GPS (computadores): no tienen recorrido. */
  soloConGps?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  const buscar = useConPausa(texto.trim());
  const flota = useFlota({ activa: abierto, filtro: { buscar }, ubicar: false });
  const opciones = useMemo(
    () => (flota.data?.equipos ?? []).filter((e) => !soloConGps || e.tieneGps),
    [flota.data, soloConGps],
  );

  useEffect(() => setActivo(0), [buscar]);

  // Se cierra al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: PointerEvent) => {
      if (!caja.current?.contains(ev.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  const elegir = (e: Equipo) => {
    alElegir(e.deviceId);
    setTexto("");
    setAbierto(false);
  };

  const teclas = (ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, Math.max(0, opciones.length - 1)));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (ev.key === "Enter" && abierto && opciones[activo]) {
      ev.preventDefault();
      elegir(opciones[activo]);
    } else if (ev.key === "Escape") {
      setAbierto(false);
    }
  };

  const total = flota.total;

  return (
    <div className="selector-equipo" ref={caja}>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <div className="buscador">
        <Search aria-hidden />
        <input
          id={id}
          className="campo"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-opciones`}
          aria-autocomplete="list"
          aria-activedescendant={abierto && opciones[activo] ? `${id}-${opciones[activo].deviceId}` : undefined}
          autoComplete="off"
          placeholder={valor ? (nombreValor ?? "Cargando el equipo…") : "Busca por nombre, modelo o serial…"}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={teclas}
          data-elegido={valor && !texto ? "" : undefined}
        />
        {texto && (
          <button type="button" className="boton fantasma chico icono" aria-label="Borrar búsqueda" onClick={() => setTexto("")}>
            <X aria-hidden />
          </button>
        )}
      </div>

      {abierto && (
        <ul id={`${id}-opciones`} role="listbox" className="selector-opciones" aria-busy={flota.isFetching || undefined}>
          {flota.isLoading ? (
            <li className="suave chico selector-nota">Buscando en MobiControl…</li>
          ) : flota.isError ? (
            <li className="suave chico selector-nota">{(flota.error as Error).message}</li>
          ) : opciones.length === 0 ? (
            <li className="suave chico selector-nota">Ningún equipo coincide.</li>
          ) : (
            opciones.map((e, i) => (
              <li
                key={e.deviceId}
                id={`${id}-${e.deviceId}`}
                role="option"
                aria-selected={e.deviceId === valor}
                data-activo={i === activo || undefined}
                className="item-equipo compacto"
                onPointerDown={(ev) => ev.preventDefault()}
                onClick={() => elegir(e)}
                onPointerEnter={() => setActivo(i)}
              >
                <PuntoEstado equipo={e} />
                <span className="item-nombre">{e.nombre}</span>
                <span className="item-tiempo">{e.modelo}</span>
              </li>
            ))
          )}
          {total !== null && flota.hayMas && (
            <li className="suave chico selector-nota">
              {total.toLocaleString("es-CO")} coinciden: escribe más para acotar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
