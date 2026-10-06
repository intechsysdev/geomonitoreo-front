import { enviarJson, obtenerJson } from "./cliente";

export type TipoGeocerca = "CIRCULO" | "POLIGONO";

export interface Geocerca {
  geocercaUid: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoGeocerca;
  latitud: number;
  longitud: number;
  radioMetros: number | null;
  /** [lng, lat] por vértice, sin repetir el primero. */
  vertices: [number, number][];
  color: string;
  activa: boolean;
  creadaPor: string | null;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

export interface GeocercaCambio {
  nombre: string;
  descripcion?: string | null;
  tipo: TipoGeocerca;
  latitud?: number | null;
  longitud?: number | null;
  radioMetros?: number | null;
  vertices?: [number, number][] | null;
  color: string;
  activa: boolean;
}

export const listarGeocercas = () => obtenerJson<Geocerca[]>("/api/v1/geocercas");

export const crearGeocerca = (datos: GeocercaCambio) => enviarJson<Geocerca>("/api/v1/geocercas", datos);

export const actualizarGeocerca = (uid: string, datos: GeocercaCambio) =>
  enviarJson<Geocerca>(`/api/v1/geocercas/${uid}`, datos, "PUT");

export const eliminarGeocerca = (uid: string) => enviarJson<void>(`/api/v1/geocercas/${uid}`, undefined, "DELETE");
