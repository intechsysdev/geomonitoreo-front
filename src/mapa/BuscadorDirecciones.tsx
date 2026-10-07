import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { coordenadas } from "../formato";
import { elemento, encuadrar, irA, marcador, type Margen } from "./capas";

/** Un lugar encontrado: lo que se le pasa a las acciones de cada pantalla. */
export interface Lugar {
  nombre: string;
  direccion: string;
  /** [lng, lat] */
  posicion: [number, number];
  /** Caja del lugar (un barrio, una ciudad), si Google la da. */
  caja?: google.maps.LatLngBoundsLiteral;
}

interface Sugerencia {
  id: string;
  principal: string;
  secundario: string;
  resolver: () => Promise<Lugar>;
}

const COORDENADAS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

const SIN_PERMISO =
  "La key de Google no permite buscar direcciones. En Google Cloud, habilite Places API (New) o Geocoding API para la key.";

/** Si Places falló por permisos, no se le vuelve a preguntar en esta página: se va directo al geocodificador. */
let placesNoDisponible = false;

/** Sugerencias para lo escrito: coordenadas tal cual, o lugares de Google cerca de lo que se ve. */
async function sugerir(
  texto: string,
  mapa: google.maps.Map,
  sesion: { current: google.maps.places.AutocompleteSessionToken | null },
): Promise<Sugerencia[]> {
  const coords = COORDENADAS.exec(texto);
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const lugar: Lugar = { nombre: "Coordenadas", direccion: coordenadas(lat, lng), posicion: [lng, lat] };
      return [{ id: "coordenadas", principal: coordenadas(lat, lng), secundario: "Ir a estas coordenadas", resolver: async () => lugar }];
    }
  }

  if (!placesNoDisponible) {
    try {
      return await sugerirConPlaces(texto, mapa, sesion);
    } catch (e) {
      placesNoDisponible = true;
      console.warn("Places no disponible; se usa el geocodificador.", e);
    }
  }

  return sugerirConGeocodificador(texto, mapa);
}

async function sugerirConPlaces(
  texto: string,
  mapa: google.maps.Map,
  sesion: { current: google.maps.places.AutocompleteSessionToken | null },
): Promise<Sugerencia[]> {
  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

  // Una sesión agrupa lo que se escribe hasta elegir un lugar: Google lo cobra como una búsqueda.
  sesion.current ??= new AutocompleteSessionToken();

  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: texto,
    sessionToken: sesion.current,
    locationBias: mapa.getBounds() ?? mapa.getCenter(),
    language: "es",
    region: "co",
  });

  return suggestions.flatMap((s) => {
    const p = s.placePrediction;
    if (!p) return [];
    const principal = p.mainText?.text ?? p.text.text;
    return [{
      id: p.placeId,
      principal,
      secundario: p.secondaryText?.text ?? "",
      resolver: async () => {
        const lugar = p.toPlace();
        await lugar.fetchFields({ fields: ["displayName", "formattedAddress", "location", "viewport"] });
        sesion.current = null;
        if (!lugar.location) throw new Error("Google no dio la ubicación de ese lugar.");
        return {
          nombre: lugar.displayName ?? principal,
          direccion: lugar.formattedAddress ?? p.text.text,
          posicion: [lugar.location.lng(), lugar.location.lat()],
          caja: lugar.viewport?.toJSON(),
        };
      },
    }];
  });
}

async function sugerirConGeocodificador(texto: string, mapa: google.maps.Map): Promise<Sugerencia[]> {
  const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;

  try {
    const { results } = await new Geocoder().geocode({ address: texto, region: "co", bounds: mapa.getBounds() ?? undefined });
    return results.slice(0, 6).map((r) => {
      const [principal, ...resto] = r.formatted_address.split(",");
      const lugar: Lugar = {
        nombre: principal.trim(),
        direccion: r.formatted_address,
        posicion: [r.geometry.location.lng(), r.geometry.location.lat()],
        caja: r.geometry.viewport?.toJSON(),
      };
      return { id: r.place_id, principal: lugar.nombre, secundario: resto.join(",").trim(), resolver: async () => lugar };
    });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "ZERO_RESULTS") return [];
    throw new Error(codigo === "REQUEST_DENIED" ? SIN_PERMISO : "No se pudo buscar la dirección. Intente de nuevo.", { cause: e });
  }
}

/**
 * Buscador de direcciones sobre el mapa. Encuentra direcciones, lugares y coordenadas, lleva el
 * mapa allá y deja un pin; cada pantalla agrega sus acciones sobre el lugar (crear una geocerca,
 * ver los equipos cercanos…).
 */
export function BuscadorDirecciones({
  mapa,
  margen,
  acciones,
}: {
  mapa: google.maps.Map | null;
  /** Lo que tapan los paneles, para que el lugar no quede debajo de ellos. */
  margen: Margen;
  acciones?: (lugar: Lugar) => ReactNode;
}) {
  const id = useId();
  const idLista = `${id}-lista`;
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[] | null>(null);
  const [activa, setActiva] = useState(-1);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const sesion = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Sugerencias mientras se escribe, con una pausa para no preguntar en cada tecla.
  useEffect(() => {
    const consulta = texto.trim();
    if (!mapa || consulta.length < 3 || consulta === lugar?.nombre) {
      setSugerencias(null);
      return;
    }

    let vigente = true;
    const espera = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const encontradas = await sugerir(consulta, mapa, sesion);
        if (!vigente) return;
        setSugerencias(encontradas);
        setActiva(-1);
        setAbierto(true);
        setError(null);
      } catch (e) {
        if (vigente) setError((e as Error).message);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 250);

    return () => {
      vigente = false;
      window.clearTimeout(espera);
    };
  }, [texto, mapa, lugar]);

  // El número de resultados se anuncia con calma, no en cada tecla.
  useEffect(() => {
    if (!sugerencias) return;
    const t = window.setTimeout(
      () => setAnuncio(sugerencias.length ? `${sugerencias.length} resultados. Use las flechas para elegir.` : "Sin resultados."),
      600,
    );
    return () => window.clearTimeout(t);
  }, [sugerencias]);

  // El pin del lugar elegido.
  useEffect(() => {
    if (!mapa || !lugar) return;
    const pin = marcador(mapa, lugar.posicion, elemento("lugar-pin"), { title: lugar.direccion, zIndex: 3000 });
    return () => { pin.map = null; };
  }, [mapa, lugar]);

  async function elegir(s: Sugerencia) {
    setAbierto(false);
    setBuscando(true);
    try {
      const encontrado = await s.resolver();
      setLugar(encontrado);
      setTexto(encontrado.nombre);
      setError(null);
      if (!mapa) return;
      if (encontrado.caja) {
        const { west, south, east, north } = encontrado.caja;
        encuadrar(mapa, [[west, south], [east, north]], margen, 17);
      } else {
        irA(mapa, encontrado.posicion, 17);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  function limpiar() {
    setTexto("");
    setLugar(null);
    setSugerencias(null);
    setError(null);
    sesion.current = null;
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    const lista = sugerencias ?? [];
    if (e.key === "ArrowDown" && lista.length) {
      e.preventDefault();
      setAbierto(true);
      setActiva((a) => (a + 1) % lista.length);
    } else if (e.key === "ArrowUp" && lista.length) {
      e.preventDefault();
      setActiva((a) => (a <= 0 ? lista.length - 1 : a - 1));
    } else if (e.key === "Enter" && lista.length) {
      e.preventDefault();
      void elegir(lista[Math.max(0, activa)]);
    } else if (e.key === "Escape") {
      if (abierto) setAbierto(false);
      else limpiar();
    }
  }

  const visibles = abierto && sugerencias !== null;

  return (
    <div className="buscador-mapa">
      <div className="buscador-caja vidrio">
        <Search aria-hidden />
        <label className="visualmente-oculto" htmlFor={id}>Buscar dirección, lugar o coordenadas</label>
        <input
          id={id}
          className="campo"
          type="search"
          role="combobox"
          aria-expanded={visibles}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={visibles && activa >= 0 ? `${idLista}-${activa}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar dirección, lugar o coordenadas…"
          value={texto}
          disabled={!mapa}
          onChange={(e) => { setTexto(e.target.value); if (lugar) setLugar(null); }}
          onKeyDown={teclas}
          onFocus={() => sugerencias && setAbierto(true)}
          onBlur={() => setAbierto(false)}
        />
        {buscando ? (
          <Loader2 aria-label="Buscando" className="girando" />
        ) : (
          texto && (
            <button type="button" className="boton fantasma chico icono" aria-label="Limpiar búsqueda" onClick={limpiar}>
              <X aria-hidden />
            </button>
          )
        )}
      </div>

      <ul id={idLista} role="listbox" aria-label="Lugares encontrados" className="sugerencias vidrio" hidden={!visibles}>
        {sugerencias?.length === 0 && <li className="sugerencia-vacia suave chico">Sin resultados para “{texto.trim()}”.</li>}
        {sugerencias?.map((s, i) => (
          <li
            key={s.id}
            id={`${idLista}-${i}`}
            role="option"
            aria-selected={i === activa}
            className="sugerencia"
            // mousedown y no click: el clic llegaría después del blur, con la lista ya cerrada.
            onMouseDown={(e) => { e.preventDefault(); void elegir(s); }}
            onMouseEnter={() => setActiva(i)}
          >
            <MapPin aria-hidden />
            <span className="item-texto">
              <span className="item-nombre">{s.principal}</span>
              {s.secundario && <span className="item-sub">{s.secundario}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="visualmente-oculto" aria-live="polite">{anuncio}</p>

      {error && <p className="buscador-error vidrio" role="alert">{error}</p>}

      {lugar && (
        <div className="lugar-tarjeta vidrio">
          <MapPin aria-hidden className="lugar-icono" />
          <div className="lugar-texto">
            <strong>{lugar.nombre}</strong>
            {lugar.direccion !== lugar.nombre && <span className="suave chico">{lugar.direccion}</span>}
            {lugar.direccion !== coordenadas(lugar.posicion[1], lugar.posicion[0]) && (
              <span className="mono chico suave">{coordenadas(lugar.posicion[1], lugar.posicion[0])}</span>
            )}
          </div>
          <div className="lugar-acciones">
            {acciones?.(lugar)}
            <button type="button" className="boton chico fantasma" onClick={limpiar}>Quitar</button>
          </div>
        </div>
      )}
    </div>
  );
}
