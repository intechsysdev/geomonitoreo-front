import type { StyleSpecification } from "maplibre-gl";

export type FondoMapa = "auto" | "calles" | "satelite";

export const FONDOS: { id: FondoMapa; nombre: string }[] = [
  { id: "auto", nombre: "Mapa" },
  { id: "calles", nombre: "Calles" },
  { id: "satelite", nombre: "Satélite" },
];

/** Fuente que existe en el servidor de CARTO: la usan las etiquetas propias en todos los fondos. */
export const FUENTE = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];

const GLIFOS = "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf";

/** Imagen satelital de Esri. Raster: no trae glifos, así que se le dan los de CARTO para las etiquetas. */
const SATELITE: StyleSpecification = {
  version: 8,
  glyphs: GLIFOS,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imágenes © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

/**
 * Estilo del fondo. "Mapa" sigue el tema de la consola: Positron de día, Dark Matter de noche. Son
 * los estilos vectoriales de CARTO, sobrios a propósito para que lo que resalte sean los equipos.
 */
export function estiloDe(fondo: FondoMapa, oscuro: boolean): string | StyleSpecification {
  switch (fondo) {
    case "satelite":
      return SATELITE;
    case "calles":
      return "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
    default:
      return oscuro
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  }
}

/** Cali: donde arranca el mapa antes de saber dónde están los equipos. */
export const CENTRO_INICIAL: [number, number] = [-76.532, 3.4516];
