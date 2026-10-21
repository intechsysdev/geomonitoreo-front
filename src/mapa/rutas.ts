import type { PuntoRecorrido } from "../api/flota";
import { distancia } from "./geo";

type LatLng = google.maps.LatLngLiteral;

/**
 * El recorrido por las vías. MobiControl recolecta la posición cada 15 minutos: en movimiento,
 * los puntos quedan a más de un kilómetro y unirlos con rectas atraviesa manzanas. Entre cada par
 * de puntos en que el equipo se movió se pide a Google la ruta por carretera (Routes API, con los
 * puntos como paradas intermedias); el resto se deja recto, porque no hay a dónde ir.
 */
export interface RutaPorVias {
  /** Camino de cada tramo: `caminos[i]` va del punto i-1 al i. `caminos[0]` no se usa. */
  caminos: LatLng[][];
  /** Cuántos tramos se trazaron por las vías. */
  porVias: number;
  /** Por qué no se pudo trazar por las vías, si es por algo que hay que corregir. */
  aviso: string | null;
}

/** Más cerca que esto es el GPS moviéndose en el sitio, no un desplazamiento. */
const MOVIMIENTO_MINIMO_METROS = 150;

/** Con un hueco más largo no se sabe por dónde fue (equipo apagado): se deja recto. */
const HUECO_MAXIMO_MS = 45 * 60_000;

/** Routes API admite 25 paradas intermedias: origen, 25 intermedias y destino son 26 tramos. */
const TRAMOS_POR_PEDIDO = 26;

/** Una ruta mucho más larga que la recta es un desvío absurdo (GPS impreciso): se descarta. */
const DESVIO_MAXIMO = 4;

const AVISO_SIN_PERMISO =
  "La ruta se muestra en línea recta: para dibujarla por las vías, habilite la Routes API en Google Cloud para la key de Geomonitoreo.";

/** Lo que ya se calculó, por tramo de puntos: volver a abrir el mismo recorrido no repite pedidos. */
const memoria = new Map<string, LatLng[][] | null>();

const recta = (a: PuntoRecorrido, b: PuntoRecorrido): LatLng[] => [
  { lat: a.latitud, lng: a.longitud },
  { lat: b.latitud, lng: b.longitud },
];

const metros = (a: LatLng, b: LatLng) => distancia([a.lng, a.lat], [b.lng, b.lat]);
const largo = (camino: LatLng[]) => camino.reduce((t, p, i) => (i ? t + metros(camino[i - 1], p) : 0), 0);

export async function rutaPorVias(puntos: PuntoRecorrido[]): Promise<RutaPorVias> {
  const caminos: LatLng[][] = puntos.map((p, i) => (i === 0 ? [] : recta(puntos[i - 1], p)));

  // Tramos en que el equipo se movió, agrupados en cadenas de tramos seguidos.
  const cadenas: [number, number][] = [];
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const mueve =
      distancia([a.longitud, a.latitud], [b.longitud, b.latitud]) >= MOVIMIENTO_MINIMO_METROS &&
      new Date(b.momento).getTime() - new Date(a.momento).getTime() <= HUECO_MAXIMO_MS;
    if (!mueve) continue;
    const ultima = cadenas[cadenas.length - 1];
    if (ultima && ultima[1] === i - 1) ultima[1] = i;
    else cadenas.push([i, i]);
  }

  // Cada cadena en pedidos de hasta 26 tramos: [primer tramo, último tramo].
  const pedidos: [number, number][] = [];
  for (const [desde, hasta] of cadenas)
    for (let i = desde; i <= hasta; i += TRAMOS_POR_PEDIDO) pedidos.push([i, Math.min(hasta, i + TRAMOS_POR_PEDIDO - 1)]);

  let porVias = 0;
  let aviso: string | null = null;

  // De a dos pedidos a la vez: un recorrido de una semana son pocas decenas.
  for (let k = 0; k < pedidos.length && !aviso; k += 2) {
    const lote = pedidos.slice(k, k + 2);
    const resultados = await Promise.all(lote.map(([a, b]) => trazar(puntos.slice(a - 1, b + 1))));

    resultados.forEach((r, j) => {
      if (r === "sin-permiso") {
        aviso = AVISO_SIN_PERMISO;
        return;
      }
      if (!r) return;
      const [a] = lote[j];
      r.forEach((camino, n) => {
        const i = a + n;
        const directo = metros(caminos[i][0], caminos[i][1]);
        if (camino.length > 1 && largo(camino) <= directo * DESVIO_MAXIMO + 500) {
          caminos[i] = camino;
          porVias++;
        }
      });
    });
  }

  return { caminos, porVias, aviso };
}

/**
 * La ruta por carretera que pasa por los puntos dados, como un camino por tramo. Null si Google no
 * encontró ruta; "sin-permiso" si la key no tiene habilitado el servicio.
 */
async function trazar(tramo: PuntoRecorrido[]): Promise<LatLng[][] | null | "sin-permiso"> {
  const clave = tramo.map((p) => `${p.latitud.toFixed(5)},${p.longitud.toFixed(5)}`).join("|");
  if (memoria.has(clave)) return memoria.get(clave)!;

  const posiciones = tramo.map((p) => ({ lat: p.latitud, lng: p.longitud }));
  const origen = posiciones[0];
  const destino = posiciones[posiciones.length - 1];
  const intermedios = posiciones.slice(1, -1);

  try {
    const libreria = (await google.maps.importLibrary("routes")) as unknown as LibreriaRutas;
    let caminos: LatLng[][];

    if (libreria.Route?.computeRoutes) {
      // Routes API (la vigente): una "leg" por cada par de puntos seguidos.
      const { routes } = await libreria.Route.computeRoutes({
        origin: origen,
        destination: destino,
        intermediates: intermedios.map((location) => ({ location })),
        travelMode: "DRIVING",
        fields: ["legs"],
      });
      const legs = routes?.[0]?.legs ?? [];
      caminos = legs.map((leg) => (leg.path ?? []).map((p) => ({ lat: p.lat, lng: p.lng })));
    } else {
      // Directions (la anterior), para las cuentas que todavía la tienen.
      const servicio = new libreria.DirectionsService();
      const r = await servicio.route({
        origin: origen,
        destination: destino,
        waypoints: intermedios.map((location) => ({ location, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
      });
      caminos = (r.routes[0]?.legs ?? []).map((leg) => leg.steps.flatMap((s) => s.path.map((p) => p.toJSON())));
    }

    const resultado = caminos.length === tramo.length - 1 ? caminos : null;
    memoria.set(clave, resultado);
    return resultado;
  } catch (e) {
    const texto = String((e as { message?: string; code?: string })?.message ?? e);
    if (/denied|not authorized|permission|not enabled|API_KEY|PERMISSION|403/i.test(texto)) {
      console.warn("Google no permitió trazar la ruta por las vías:", texto);
      return "sin-permiso";
    }
    // Sin ruta posible entre esos puntos (por ejemplo, uno en el agua): se deja recto.
    memoria.set(clave, null);
    return null;
  }
}

/** Lo que se usa de la librería "routes"; los tipos de @types/google.maps aún no traen Route. */
interface LibreriaRutas {
  DirectionsService: typeof google.maps.DirectionsService;
  Route?: {
    computeRoutes(solicitud: {
      origin: LatLng;
      destination: LatLng;
      intermediates: { location: LatLng }[];
      travelMode: string;
      fields: string[];
    }): Promise<{ routes?: { legs?: { path?: { lat: number; lng: number }[] }[] }[] }>;
  };
}

/** El punto a una fracción (0 a 1) del largo de un camino. */
export function puntoEnCamino(camino: LatLng[], fraccion: number): LatLng {
  if (camino.length === 0) return { lat: 0, lng: 0 };
  if (camino.length === 1 || fraccion <= 0) return camino[0];
  if (fraccion >= 1) return camino[camino.length - 1];

  const total = largo(camino);
  let objetivo = total * fraccion;
  for (let i = 1; i < camino.length; i++) {
    const tramo = metros(camino[i - 1], camino[i]);
    if (objetivo <= tramo) {
      const f = tramo === 0 ? 0 : objetivo / tramo;
      return {
        lat: camino[i - 1].lat + (camino[i].lat - camino[i - 1].lat) * f,
        lng: camino[i - 1].lng + (camino[i].lng - camino[i - 1].lng) * f,
      };
    }
    objetivo -= tramo;
  }
  return camino[camino.length - 1];
}
