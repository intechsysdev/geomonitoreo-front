import { MarkerClusterer, SuperClusterAlgorithm, type Renderer } from "@googlemaps/markerclusterer";
import type { Equipo } from "../api/flota";
import type { Geocerca } from "../api/geocercas";
import { estadoDe, type EstadoEquipo } from "../formato";
import { caja, poligonoDe } from "./geo";

/** [lng, lat] (el orden de GeoJSON, el que usa el resto de la consola) a lo que pide Google. */
export const aLatLng = ([lng, lat]: [number, number]): google.maps.LatLngLiteral => ({ lat, lng });

/** Desde qué zoom se ven los nombres de las geocercas y de los equipos. */
const ZOOM_NOMBRES_ZONAS = 12;
const ZOOM_NOMBRES_EQUIPOS = 14;

/** Un marcador con contenido propio (HTML con las clases de la consola). */
export function marcador(
  mapa: google.maps.Map,
  posicion: [number, number],
  contenido: HTMLElement,
  opciones: Partial<google.maps.marker.AdvancedMarkerElementOptions> = {},
): google.maps.marker.AdvancedMarkerElement {
  return new google.maps.marker.AdvancedMarkerElement({ map: mapa, position: aLatLng(posicion), content: contenido, ...opciones });
}

export function elemento(clase: string, texto?: string, datos: Record<string, string> = {}): HTMLDivElement {
  const div = document.createElement("div");
  div.className = clase;
  if (texto !== undefined) div.textContent = texto;
  Object.assign(div.dataset, datos);
  return div;
}

/** Relleno de lado a lado: la caja de los paneles que tapan el mapa, para no encuadrar debajo. */
export type Margen = google.maps.Padding;

/** Que se vean todos los puntos, sin acercarse más de maxZoom. */
export function encuadrar(mapa: google.maps.Map, puntos: [number, number][], margen: Margen, maxZoom = 16) {
  const limites = caja(puntos);
  if (!limites) return;

  const [[oeste, sur], [este, norte]] = limites;
  if (oeste === este && sur === norte) {
    mapa.panTo({ lat: sur, lng: oeste });
    mapa.setZoom(maxZoom);
    return;
  }

  google.maps.event.addListenerOnce(mapa, "idle", () => {
    if ((mapa.getZoom() ?? 0) > maxZoom) mapa.setZoom(maxZoom);
  });
  mapa.fitBounds({ west: oeste, south: sur, east: este, north: norte }, margen);
}

/**
 * Ir a un punto. `corrimientoX` deja el punto a la izquierda del centro (en píxeles), para que
 * no quede debajo del cajón de la derecha.
 */
export function irA(mapa: google.maps.Map, posicion: [number, number], zoom: number, corrimientoX = 0) {
  mapa.setZoom(zoom);
  mapa.panTo(aLatLng(posicion));
  if (corrimientoX) google.maps.event.addListenerOnce(mapa, "idle", () => mapa.panBy(corrimientoX, 0));
}

// ------------------------------------------------------------------------------------------
// Geocercas
// ------------------------------------------------------------------------------------------

interface ZonaDibujada {
  geocerca: Geocerca;
  forma: google.maps.Polygon;
  /** Borde punteado de las inactivas: los polígonos de Google no tienen trazo punteado. */
  punteado: google.maps.Polyline | null;
  etiqueta: google.maps.marker.AdvancedMarkerElement;
}

/**
 * Las zonas: relleno tenue y borde de su color, y su nombre de cerca. Las inactivas, con el
 * borde punteado.
 */
export class CapaGeocercas {
  private zonas = new Map<string, ZonaDibujada>();
  private resaltada: string | null = null;
  private clicables = true;
  private escucha: google.maps.MapsEventListener;
  private mapa: google.maps.Map;
  private opciones: { opacidad: number; alElegir?: (uid: string) => void };

  constructor(mapa: google.maps.Map, opciones: { opacidad: number; alElegir?: (uid: string) => void }) {
    this.mapa = mapa;
    this.opciones = opciones;
    this.escucha = mapa.addListener("zoom_changed", () => this.mostrarNombres());
  }

  poner(geocercas: Geocerca[]) {
    const vigentes = new Set(geocercas.map((g) => g.geocercaUid));
    for (const [uid, zona] of this.zonas) if (!vigentes.has(uid)) this.borrar(uid, zona);

    for (const g of geocercas) {
      const actual = this.zonas.get(g.geocercaUid);
      if (actual && actual.geocerca === g) continue;
      if (actual) this.borrar(g.geocercaUid, actual);
      this.zonas.set(g.geocercaUid, this.dibujar(g));
    }

    this.estilos();
    this.mostrarNombres();
  }

  resaltar(uid: string | null) {
    this.resaltada = uid;
    this.estilos();
  }

  /** Mientras se dibuja, los clics tienen que llegar al mapa y no a las zonas. */
  permitirClics(si: boolean) {
    this.clicables = si;
    for (const z of this.zonas.values()) z.forma.setOptions({ clickable: si && !!this.opciones.alElegir });
  }

  quitar() {
    for (const [uid, zona] of this.zonas) this.borrar(uid, zona);
    this.escucha.remove();
  }

  private dibujar(g: Geocerca): ZonaDibujada {
    const camino = poligonoDe(g).map(aLatLng);

    const forma = new google.maps.Polygon({
      map: this.mapa,
      paths: camino,
      fillColor: g.color,
      strokeColor: g.color,
      clickable: this.clicables && !!this.opciones.alElegir,
      zIndex: 1,
    });
    if (this.opciones.alElegir) forma.addListener("click", () => this.opciones.alElegir!(g.geocercaUid));

    const punteado = g.activa
      ? null
      : new google.maps.Polyline({
          map: this.mapa,
          path: camino,
          strokeOpacity: 0,
          clickable: false,
          zIndex: 2,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: g.color, scale: 2 }, offset: "0", repeat: "10px" }],
        });

    const nombre = elemento("etiqueta-zona", g.nombre);
    nombre.style.setProperty("--color", g.color);
    const etiqueta = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: g.latitud, lng: g.longitud },
      content: nombre,
      zIndex: 3,
    });

    return { geocerca: g, forma, punteado, etiqueta };
  }

  private estilos() {
    const base = this.opciones.opacidad;
    for (const [uid, z] of this.zonas) {
      const resaltada = uid === this.resaltada;
      z.forma.setOptions({
        fillOpacity: resaltada ? base * 2.2 : base,
        strokeWeight: resaltada ? 3.5 : 2,
        strokeOpacity: z.geocerca.activa ? 0.95 : 0,
      });
    }
  }

  private mostrarNombres() {
    const visible = (this.mapa.getZoom() ?? 0) >= ZOOM_NOMBRES_ZONAS;
    for (const z of this.zonas.values()) z.etiqueta.map = visible ? this.mapa : null;
  }

  private borrar(uid: string, zona: ZonaDibujada) {
    google.maps.event.clearInstanceListeners(zona.forma);
    zona.forma.setMap(null);
    zona.punteado?.setMap(null);
    zona.etiqueta.map = null;
    this.zonas.delete(uid);
  }
}

// ------------------------------------------------------------------------------------------
// Flota
// ------------------------------------------------------------------------------------------

/**
 * Equipos agrupados: a lo lejos, un círculo con el número, teñido según cuántos están en línea;
 * de cerca, cada equipo con el color de su estado y, más cerca todavía, su nombre.
 */
export class CapaFlota {
  private marcadores = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  private estados = new WeakMap<google.maps.marker.AdvancedMarkerElement, EstadoEquipo>();
  private agrupador: MarkerClusterer;
  private escucha: google.maps.MapsEventListener;
  private mapa: google.maps.Map;
  private alElegir?: (deviceId: string) => void;

  constructor(mapa: google.maps.Map, alElegir?: (deviceId: string) => void) {
    this.mapa = mapa;
    this.alElegir = alElegir;
    this.agrupador = new MarkerClusterer({
      map: mapa,
      algorithm: new SuperClusterAlgorithm({ radius: 60, maxZoom: 15 }),
      renderer: this.renderizador(),
    });
    this.escucha = mapa.addListener("zoom_changed", () => this.mostrarNombres());
    this.mostrarNombres();
  }

  poner(equipos: Equipo[]) {
    const ahora = Date.now();
    const conPosicion = equipos.filter((e) => e.latitud !== null && e.longitud !== null);
    const vigentes = new Set(conPosicion.map((e) => e.deviceId));

    const quitar = [...this.marcadores].filter(([id]) => !vigentes.has(id));
    for (const [id] of quitar) this.marcadores.delete(id);
    if (quitar.length) this.agrupador.removeMarkers(quitar.map(([, m]) => m), true);

    const nuevos: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const e of conPosicion) {
      const estado = estadoDe(e, ahora);
      const posicion = { lat: e.latitud!, lng: e.longitud! };
      let m = this.marcadores.get(e.deviceId);

      if (!m) {
        const punto = elemento("equipo-punto", undefined, { estado });
        punto.append(elemento("equipo-nombre", e.nombre));
        // Sin clic propio, que el clic pase al mapa (en Geocercas, para dibujar encima).
        if (!this.alElegir) punto.style.pointerEvents = "none";
        m = new google.maps.marker.AdvancedMarkerElement({
          position: posicion,
          content: punto,
          title: e.nombre,
          gmpClickable: !!this.alElegir,
          zIndex: 10,
        });
        if (this.alElegir) m.addEventListener("gmp-click", () => this.alElegir!(e.deviceId));
        this.marcadores.set(e.deviceId, m);
        nuevos.push(m);
      } else {
        m.position = posicion;
        (m.content as HTMLElement).dataset.estado = estado;
      }
      this.estados.set(m, estado);
    }

    if (nuevos.length) this.agrupador.addMarkers(nuevos, true);
    this.agrupador.render();
  }

  quitar() {
    this.agrupador.clearMarkers();
    this.agrupador.setMap(null);
    this.marcadores.clear();
    this.escucha.remove();
  }

  private mostrarNombres() {
    this.mapa.getDiv().dataset.nombres = String((this.mapa.getZoom() ?? 0) >= ZOOM_NOMBRES_EQUIPOS);
  }

  private renderizador(): Renderer {
    return {
      render: ({ count, markers, position }) => {
        const enLinea = markers.filter((m) => this.estados.get(m as google.maps.marker.AdvancedMarkerElement) === "en-linea").length;
        const grupo = elemento("grupo-equipos", count > 999 ? `${Math.round(count / 100) / 10}k` : String(count));
        grupo.style.setProperty("--proporcion", String(enLinea / count));
        grupo.style.setProperty("--tamano", `${count < 10 ? 34 : count < 50 ? 44 : count < 200 ? 56 : 68}px`);
        return new google.maps.marker.AdvancedMarkerElement({
          position,
          content: grupo,
          title: `${count} equipos, ${enLinea} en línea`,
          zIndex: 1000 + count,
        });
      },
    };
  }
}
