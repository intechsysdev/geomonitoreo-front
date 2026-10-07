/**
 * Carga del SDK de Google Maps. Se pide una sola vez por página: Google no permite cargarlo dos
 * veces, ni con otra key. Si la empresa cambia de key, el mapa nuevo usa la ya cargada hasta que
 * se recargue la página.
 */

declare global {
  interface Window {
    __geoMapsListo?: () => void;
    /** Google llama a esta función global cuando rechaza la key (dominio no permitido, API apagada…). */
    gm_authFailure?: () => void;
  }
}

let carga: Promise<void> | null = null;
const rechazos = new Set<(motivo: string) => void>();

const MOTIVO_KEY =
  "Google rechazó la key de Google Maps. Revise en Google Cloud que la key permita este dominio y tenga " +
  "habilitada la Maps JavaScript API.";

export function cargarGoogleMaps(llave: string): Promise<void> {
  // Los tipos dan `google` por cargado siempre; en tiempo de ejecución puede no estar todavía.
  if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve();
  if (carga) return carga;

  carga = new Promise<void>((resolver, rechazar) => {
    window.__geoMapsListo = () => resolver();
    window.gm_authFailure = () => rechazos.forEach((r) => r(MOTIVO_KEY));

    const parametros = new URLSearchParams({
      key: llave,
      v: "weekly",
      loading: "async",
      language: "es",
      region: "CO",
      callback: "__geoMapsListo",
    });

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${parametros}`;
    script.async = true;
    script.onerror = () => {
      carga = null;
      script.remove();
      rechazar(new Error("No se pudo descargar Google Maps. Revise la conexión."));
    };
    document.head.append(script);
  });

  return carga;
}

/** Avisa si Google rechaza la key después de cargado el mapa (llega tarde, por su cuenta). */
export function alRechazarKey(alRechazar: (motivo: string) => void): () => void {
  rechazos.add(alRechazar);
  return () => rechazos.delete(alRechazar);
}

/** Las librerías que usa la consola, ya cargadas y tipadas. */
export async function librerias() {
  const [mapas, marcadores] = await Promise.all([
    google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
  ]);
  return { mapas, marcadores };
}
