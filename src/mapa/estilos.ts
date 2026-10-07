export type FondoMapa = "mapa" | "satelite" | "relieve";

export const FONDOS: { id: FondoMapa; nombre: string }[] = [
  { id: "mapa", nombre: "Mapa" },
  { id: "satelite", nombre: "Satélite" },
  { id: "relieve", nombre: "Relieve" },
];

/** Satélite va con calles y nombres encima: sin ellos no se sabe dónde se está. */
export function tipoDe(fondo: FondoMapa): google.maps.MapTypeId | string {
  switch (fondo) {
    case "satelite": return "hybrid";
    case "relieve": return "terrain";
    default: return "roadmap";
  }
}

/** Cali: donde arranca el mapa antes de saber dónde están los equipos. */
export const CENTRO_INICIAL: google.maps.LatLngLiteral = { lat: 3.4516, lng: -76.532 };

/**
 * Map ID de demostración de Google. Los marcadores avanzados exigen un Map ID; si la empresa no
 * cargó el suyo en One (GOOGLE_MAPS_MAP_ID), se usa este.
 */
export const MAP_ID_DEMO = "DEMO_MAP_ID";
