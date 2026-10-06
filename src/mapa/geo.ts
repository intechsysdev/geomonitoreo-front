import type { Feature, Polygon } from "geojson";
import type { Geocerca } from "../api/geocercas";

const RADIO_TIERRA = 6_371_008.8;

/** Distancia en metros entre dos puntos [lng, lat]. */
export function distancia([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Círculo como polígono de 64 lados: el mapa no dibuja círculos en metros. */
export function anilloCirculo(centro: [number, number], radioMetros: number, lados = 64): [number, number][] {
  const [lng, lat] = centro;
  const dLat = (radioMetros / RADIO_TIERRA) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);

  const anillo: [number, number][] = [];
  for (let i = 0; i <= lados; i++) {
    const t = (i / lados) * 2 * Math.PI;
    anillo.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return anillo;
}

export function poligonoDe(g: Pick<Geocerca, "tipo" | "latitud" | "longitud" | "radioMetros" | "vertices">): [number, number][] {
  if (g.tipo === "CIRCULO") return anilloCirculo([g.longitud, g.latitud], g.radioMetros ?? 0);
  return g.vertices.length ? [...g.vertices, g.vertices[0]] : [];
}

export function geocercaComoFeature(g: Geocerca): Feature<Polygon> {
  return {
    type: "Feature",
    id: g.geocercaUid,
    properties: { uid: g.geocercaUid, nombre: g.nombre, color: g.color, activa: g.activa },
    geometry: { type: "Polygon", coordinates: [poligonoDe(g)] },
  };
}

/** Caja que encierra una lista de puntos [lng, lat], o null si no hay ninguno. */
export function caja(puntos: [number, number][]): [[number, number], [number, number]] | null {
  if (puntos.length === 0) return null;
  let [oeste, sur] = puntos[0];
  let [este, norte] = puntos[0];
  for (const [lng, lat] of puntos) {
    oeste = Math.min(oeste, lng);
    este = Math.max(este, lng);
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
  }
  return [[oeste, sur], [este, norte]];
}
