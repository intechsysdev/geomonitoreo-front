import type { Map as MapaLibre, MapLayerMouseEvent, GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { Equipo } from "../api/flota";
import type { Geocerca } from "../api/geocercas";
import { estadoDe } from "../formato";
import { geocercaComoFeature } from "./geo";
import { FUENTE } from "./estilos";
import { VACIO } from "./useMapa";

/** Colores de estado en el mapa. El mapa no lee variables CSS: van como valores. */
export const COLORES_ESTADO = {
  "en-linea": "#22c55e",
  inactivo: "#94a3b8",
  "sin-senal": "#ef4444",
} as const;

export function flotaComoGeoJson(equipos: Equipo[]): FeatureCollection<Point> {
  const ahora = Date.now();
  return {
    type: "FeatureCollection",
    features: equipos
      .filter((e) => e.latitud !== null && e.longitud !== null)
      .map<Feature<Point>>((e) => ({
        type: "Feature",
        properties: { id: e.deviceId, nombre: e.nombre, estado: estadoDe(e, ahora) },
        geometry: { type: "Point", coordinates: [e.longitud!, e.latitud!] },
      })),
  };
}

export const geocercasComoGeoJson = (geocercas: Geocerca[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: geocercas.map(geocercaComoFeature),
});

/** Zonas: relleno tenue y borde de su color. Van debajo de los equipos. */
export function instalarCapasGeocercas(mapa: MapaLibre, opacidad = 0.12) {
  if (mapa.getSource("geocercas")) return;

  mapa.addSource("geocercas", { type: "geojson", data: VACIO, promoteId: "uid" });
  mapa.addLayer({
    id: "geocercas-relleno",
    type: "fill",
    source: "geocercas",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": ["case", ["boolean", ["feature-state", "resaltada"], false], opacidad * 2.2, opacidad],
    },
  });
  mapa.addLayer({
    id: "geocercas-borde",
    type: "line",
    source: "geocercas",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", ["boolean", ["feature-state", "resaltada"], false], 3.5, 2],
      "line-dasharray": ["case", ["get", "activa"], ["literal", [1, 0]], ["literal", [2, 2]]],
    },
  });
  mapa.addLayer({
    id: "geocercas-nombre",
    type: "symbol",
    source: "geocercas",
    minzoom: 12,
    layout: {
      "text-field": ["get", "nombre"],
      "text-font": FUENTE,
      "text-size": 12,
      "symbol-placement": "point",
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-color": "rgba(255,255,255,0.85)",
      "text-halo-width": 1.5,
    },
  });
}

/**
 * Equipos agrupados: a lo lejos, un círculo con el número; de cerca, cada equipo con el color
 * de su estado y, más cerca todavía, su nombre.
 */
export function instalarCapasFlota(mapa: MapaLibre, oscuro: boolean) {
  if (mapa.getSource("flota")) return;

  mapa.addSource("flota", {
    type: "geojson",
    data: VACIO,
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 15,
    // Cuántos de cada grupo están en línea: el círculo se tiñe según la proporción.
    clusterProperties: { enLinea: ["+", ["case", ["==", ["get", "estado"], "en-linea"], 1, 0]] },
  });

  const halo = oscuro ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.95)";

  mapa.addLayer({
    id: "grupos",
    type: "circle",
    source: "flota",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "interpolate", ["linear"], ["/", ["get", "enLinea"], ["get", "point_count"]],
        0, "#64748b", 0.5, "#0891b2", 1, "#16a34a",
      ],
      "circle-radius": ["step", ["get", "point_count"], 17, 10, 22, 50, 28, 200, 34],
      "circle-stroke-width": 4,
      "circle-stroke-color": oscuro ? "rgba(34,211,238,0.25)" : "rgba(8,145,178,0.22)",
    },
  });

  mapa.addLayer({
    id: "grupos-numero",
    type: "symbol",
    source: "flota",
    filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FUENTE, "text-size": 13 },
    paint: { "text-color": "#ffffff" },
  });

  mapa.addLayer({
    id: "equipos-halo",
    type: "circle",
    source: "flota",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 13,
      "circle-color": ["match", ["get", "estado"], "en-linea", COLORES_ESTADO["en-linea"], "sin-senal", COLORES_ESTADO["sin-senal"], COLORES_ESTADO.inactivo],
      "circle-opacity": 0.22,
    },
  });

  mapa.addLayer({
    id: "equipos",
    type: "circle",
    source: "flota",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 6.5,
      "circle-color": ["match", ["get", "estado"], "en-linea", COLORES_ESTADO["en-linea"], "sin-senal", COLORES_ESTADO["sin-senal"], COLORES_ESTADO.inactivo],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": halo,
    },
  });

  mapa.addLayer({
    id: "equipos-nombre",
    type: "symbol",
    source: "flota",
    filter: ["!", ["has", "point_count"]],
    minzoom: 13.5,
    layout: {
      "text-field": ["get", "nombre"],
      "text-font": FUENTE,
      "text-size": 12,
      "text-offset": [0, 1.3],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "text-color": oscuro ? "#e2e8f0" : "#0f172a",
      "text-halo-color": halo,
      "text-halo-width": 1.6,
    },
  });
}

/** Clic en un grupo: acercarse hasta que se abra. Clic en un equipo: elegirlo. */
export function conectarClicsFlota(mapa: MapaLibre, alElegir: (deviceId: string) => void) {
  const enGrupo = async (e: MapLayerMouseEvent) => {
    const grupo = e.features?.[0];
    if (!grupo) return;
    const fuente = mapa.getSource("flota") as GeoJSONSource;
    const zoom = await fuente.getClusterExpansionZoom(grupo.properties.cluster_id as number);
    mapa.easeTo({ center: (grupo.geometry as Point).coordinates as [number, number], zoom: zoom + 0.5 });
  };

  const enEquipo = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties.id as string | undefined;
    if (id) alElegir(id);
  };

  const puntero = () => (mapa.getCanvas().style.cursor = "pointer");
  const normal = () => (mapa.getCanvas().style.cursor = "");

  mapa.on("click", "grupos", enGrupo);
  mapa.on("click", "equipos", enEquipo);
  for (const capa of ["grupos", "equipos"]) {
    mapa.on("mouseenter", capa, puntero);
    mapa.on("mouseleave", capa, normal);
  }

  return () => {
    mapa.off("click", "grupos", enGrupo);
    mapa.off("click", "equipos", enEquipo);
    for (const capa of ["grupos", "equipos"]) {
      mapa.off("mouseenter", capa, puntero);
      mapa.off("mouseleave", capa, normal);
    }
  };
}
