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
let ultimoCodigo: string | null = null;
let motivoActual: string | null = null;

/**
 * Lo que hay que corregir según el código con que Google rechaza la key. Google no lo entrega por
 * ninguna API: solo lo escribe en la consola del navegador ("Google Maps JavaScript API error: X").
 */
function motivoDe(codigo: string | null): string {
  const origen = window.location.origin;
  switch (codigo) {
    case "RefererNotAllowedMapError":
      return `Google no permite usar la key desde ${origen}. En Google Cloud → Credenciales → la key → Restricciones de sitios web, agregue ${origen}/*.`;
    case "ApiNotActivatedMapError":
      return "La Maps JavaScript API no está habilitada en el proyecto de Google Cloud de la key. Habilítela en APIs y servicios.";
    case "ApiTargetBlockedMapError":
      return "La key tiene restricción de APIs y no incluye Maps JavaScript API. Agréguela, junto con Places API (New) y Geocoding API para el buscador.";
    case "BillingNotEnabledMapError":
      return "El proyecto de Google Cloud de la key no tiene la facturación activa. Google Maps la exige aunque el uso esté dentro del cupo gratuito.";
    case "InvalidKeyMapError":
    case "InvalidKey":
      return "La key de Google Maps no es válida. Revise que esté copiada completa en One (GOOGLE_MAPS_API_KEY de Geomonitoreo).";
    case "ExpiredKeyMapError":
    case "DeletedApiProjectMapError":
      return "La key de Google Maps ya no existe o venció. Cree una nueva en Google Cloud y cárguela en One.";
    case "MissingKeyMapError":
      return "Falta la key de Google Maps: cárguela en One (GOOGLE_MAPS_API_KEY de Geomonitoreo).";
    default:
      return `Google rechazó la key de Google Maps${codigo ? ` (${codigo})` : ""}. Revise en Google Cloud que permita este dominio (${origen}) y tenga habilitada la Maps JavaScript API.`;
  }
}

function avisar(codigo: string | null) {
  motivoActual = motivoDe(codigo);
  rechazos.forEach((r) => r(motivoActual!));
}

/** Escucha los errores que Google escribe en la consola, para saber por qué rechazó la key. */
function escucharErroresDeGoogle() {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const texto = typeof args[0] === "string" ? args[0] : "";
    const error = /Google Maps JavaScript API error: (\w+)/.exec(texto);
    if (error) {
      ultimoCodigo = error[1];
      avisar(ultimoCodigo);
    }
    original(...args);
  };
}

export function cargarGoogleMaps(llave: string): Promise<void> {
  // Los tipos dan `google` por cargado siempre; en tiempo de ejecución puede no estar todavía.
  if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve();
  if (carga) return carga;

  escucharErroresDeGoogle();

  carga = new Promise<void>((resolver, rechazar) => {
    window.__geoMapsListo = () => resolver();
    // El error de la consola puede llegar justo después: se espera un instante para dar el motivo exacto.
    window.gm_authFailure = () => window.setTimeout(() => avisar(ultimoCodigo), 50);

    const parametros = new URLSearchParams({
      // Sin key (solo en pruebas: la consola siempre tiene la de One) Google carga en modo desarrollo.
      ...(llave ? { key: llave } : {}),
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

/**
 * Avisa si Google rechaza la key. Llega tarde, por su cuenta, después de cargado el mapa; si ya
 * pasó (otra pantalla lo vio antes), se avisa enseguida.
 */
export function alRechazarKey(alRechazar: (motivo: string) => void): () => void {
  rechazos.add(alRechazar);
  if (motivoActual) alRechazar(motivoActual);
  return () => rechazos.delete(alRechazar);
}

/** Por qué Google rechazó la key, o null si no la ha rechazado. */
export const rechazoDeKey = () => motivoActual;

/** Las librerías que usa la consola, ya cargadas y tipadas. */
export async function librerias() {
  const [mapas, marcadores] = await Promise.all([
    google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
  ]);
  return { mapas, marcadores };
}
