import { useEffect, useRef, useState, type RefObject } from "react";
import { Map as MapaLibre, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useTema } from "../tema/Tema";
import { CENTRO_INICIAL, estiloDe, type FondoMapa } from "./estilos";

// MapLibre arma la ruta de su worker relativa a su propio archivo, y el empaquetado la rompe (el
// worker no se copia y el mapa queda en blanco). Vite lo empaqueta aparte y aquí se le da la ruta.
setWorkerUrl(urlWorker);

/**
 * Crea el mapa en el contenedor y le cambia el fondo cuando cambia el tema o la elección del
 * usuario.
 *
 * Cambiar el estilo borra las fuentes y capas propias (equipos, geocercas, recorridos). Por eso
 * se devuelve una versión que sube con cada estilo cargado: las pantallas instalan sus capas en
 * un efecto que depende de ella, y quedan puestas otra vez sin que nadie lo recuerde a mano.
 */
export function useMapa(contenedor: RefObject<HTMLDivElement | null>, fondo: FondoMapa) {
  const { oscuro } = useTema();
  const [mapa, setMapa] = useState<MapaLibre | null>(null);
  const [version, setVersion] = useState(0);
  const estiloInicial = useRef({ fondo, oscuro });

  useEffect(() => {
    if (!contenedor.current) return;

    const nuevo = new MapaLibre({
      container: contenedor.current,
      style: estiloDe(estiloInicial.current.fondo, estiloInicial.current.oscuro),
      center: CENTRO_INICIAL,
      zoom: 11,
      attributionControl: { compact: true },
      // Los controles propios van en el panel flotante; estos de MapLibre no combinan con él.
      dragRotate: false,
      pitchWithRotate: false,
    });

    nuevo.touchZoomRotate.disableRotation();
    nuevo.on("style.load", () => setVersion((v) => v + 1));
    setMapa(nuevo);

    return () => {
      nuevo.remove();
      setMapa(null);
    };
  }, [contenedor]);

  useEffect(() => {
    if (!mapa) return;
    const actual = estiloInicial.current;
    if (actual.fondo === fondo && actual.oscuro === oscuro) return;

    estiloInicial.current = { fondo, oscuro };
    mapa.setStyle(estiloDe(fondo, oscuro));
  }, [mapa, fondo, oscuro]);

  return { mapa, version };
}

/** Pone los datos en una fuente GeoJSON, si ya existe (puede estar reinstalándose). */
export function ponerDatos(mapa: MapaLibre | null, fuente: string, datos: GeoJSON.GeoJSON) {
  (mapa?.getSource(fuente) as GeoJSONSource | undefined)?.setData(datos);
}

export const VACIO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
