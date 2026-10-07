import { useEffect, useRef, useState, type RefObject } from "react";
import { useConfiguracion } from "../api/consultas";
import { useTema } from "../tema/Tema";
import { CENTRO_INICIAL, MAP_ID_DEMO, tipoDe, type FondoMapa } from "./estilos";
import { alRechazarKey, cargarGoogleMaps, librerias } from "./google";

/**
 * Crea el mapa de Google en el contenedor con la key de la empresa (variable GOOGLE_MAPS_API_KEY
 * de Geomonitoreo en One).
 *
 * El tema claro u oscuro de Google solo se elige al crear el mapa: al cambiar el tema de la
 * consola el mapa se crea de nuevo, en la misma vista. Las pantallas ponen sus capas en efectos
 * que dependen de `mapa`, así que quedan puestas otra vez solas.
 */
export function useMapa(contenedor: RefObject<HTMLDivElement | null>, fondo: FondoMapa) {
  const { oscuro } = useTema();
  const configuracion = useConfiguracion();
  const llaves = configuracion.data?.googleMaps ?? null;
  const [mapa, setMapa] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vista = useRef<{ center: google.maps.LatLngLiteral; zoom: number } | null>(null);
  // El fondo con que se crea un mapa nuevo; los cambios después los aplica el efecto de abajo.
  const fondoActual = useRef(fondo);

  useEffect(() => alRechazarKey(setError), []);

  useEffect(() => {
    const div = contenedor.current;
    if (!div || !llaves) return;

    let vivo = true;
    let creado: google.maps.Map | null = null;

    cargarGoogleMaps(llaves.apiKey)
      .then(librerias)
      .then(({ mapas }) => {
        if (!vivo) return;
        creado = new mapas.Map(div, {
          center: vista.current?.center ?? CENTRO_INICIAL,
          zoom: vista.current?.zoom ?? 11,
          mapId: llaves.mapId || MAP_ID_DEMO,
          colorScheme: oscuro ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
          mapTypeId: tipoDe(fondoActual.current),
          // Los controles propios van en el vidrio de la consola; los de Google no combinan.
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        setError(null);
        setMapa(creado);
      })
      .catch((e: Error) => vivo && setError(e.message));

    return () => {
      vivo = false;
      if (creado) {
        const centro = creado.getCenter();
        if (centro) vista.current = { center: centro.toJSON(), zoom: creado.getZoom() ?? 11 };
        google.maps.event.clearInstanceListeners(creado);
      }
      setMapa(null);
      div.replaceChildren();
    };
  }, [contenedor, llaves, oscuro]);

  useEffect(() => {
    fondoActual.current = fondo;
    mapa?.setMapTypeId(tipoDe(fondo));
  }, [mapa, fondo]);

  let aviso: string | null = error;
  if (!aviso && configuracion.data && !llaves)
    aviso = "Falta la key de Google Maps de la empresa: cárguela en Intechsys One, app Geomonitoreo → Variables (GOOGLE_MAPS_API_KEY).";

  return { mapa, aviso };
}
