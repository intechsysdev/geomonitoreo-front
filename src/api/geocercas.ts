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
  /** False si la borraron en la consola de MobiControl. */
  enMobiControl: boolean;
  referenceId: string | null;
  fechaSincronizacion: string | null;
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

/** sincronizadas en false: MobiControl no respondió y se muestran las formas guardadas. */
export interface ListaGeocercas {
  geocercas: Geocerca[];
  sincronizadas: boolean;
  aviso: string | null;
}

export const listarGeocercas = () => obtenerJson<ListaGeocercas>("/api/v1/geocercas");

/** Trae una geocerca creada en la consola de MobiControl, por su nombre exacto. */
export const importarGeocerca = (nombre: string) => enviarJson<Geocerca>("/api/v1/geocercas/importar", { nombre });

export const crearGeocerca = (datos: GeocercaCambio) => enviarJson<Geocerca>("/api/v1/geocercas", datos);

export const actualizarGeocerca = (uid: string, datos: GeocercaCambio) =>
  enviarJson<Geocerca>(`/api/v1/geocercas/${uid}`, datos, "PUT");

export const eliminarGeocerca = (uid: string) => enviarJson<void>(`/api/v1/geocercas/${uid}`, undefined, "DELETE");
