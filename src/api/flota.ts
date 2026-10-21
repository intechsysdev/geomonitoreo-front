import { enviarJson, obtenerJson } from "./cliente";
import type { Geocerca } from "./geocercas";

export interface Equipo {
  deviceId: string;
  nombre: string;
  plataforma: string | null;
  fabricante: string | null;
  modelo: string | null;
  enLinea: boolean;
  bateria: number | null;
  cargando: boolean | null;
  ultimoReporte: string | null;
  grupo: string | null;
  imei: string | null;
  telefono: string | null;
  serial: string | null;
  tieneGps: boolean;
  latitud: number | null;
  longitud: number | null;
  fechaUbicacion: string | null;
  velocidad: number | null;
  rumbo: number | null;
  /** Geocercas activas que contienen la última posición. */
  geocercas: string[];
}

export interface Flota {
  equipos: Equipo[];
  consultado: string;
}

/** Una página de la flota, ordenada por nombre. Los equipos vienen sin posición. */
export interface PaginaFlota {
  equipos: Equipo[];
  skip: number;
  take: number;
  /** La página vino llena: puede haber más equipos después. */
  hayMas: boolean;
  consultado: string;
}

/** Última posición de un equipo y las zonas que la contienen. */
export interface UbicacionEquipo {
  deviceId: string;
  latitud: number;
  longitud: number;
  momento: string;
  velocidad: number | null;
  rumbo: number | null;
  geocercas: string[];
}

/** Las zonas de un equipo según su última posición. */
export interface GeocercasEquipo {
  /** False si el equipo no ha reportado posición. */
  conPosicion: boolean;
  dentro: Geocerca[];
  cercanas: { geocerca: Geocerca; distanciaMetros: number }[];
}

export interface DetalleEquipo extends Equipo {
  versionSistema: string | null;
  versionAgente: string | null;
  fechaInscripcion: string | null;
  red: string | null;
}

export interface PuntoRecorrido {
  latitud: number;
  longitud: number;
  momento: string;
  velocidadKmh: number | null;
  rumbo: number | null;
}

export interface Parada {
  latitud: number;
  longitud: number;
  inicio: string;
  fin: string;
  minutos: number;
}

export interface EventoGeocerca {
  geocerca: string;
  nombre: string;
  tipo: "ENTRADA" | "SALIDA";
  momento: string;
  latitud: number;
  longitud: number;
}

export interface Recorrido {
  deviceId: string;
  desde: string;
  hasta: string;
  puntos: PuntoRecorrido[];
  estadisticas: {
    puntos: number;
    distanciaKm: number;
    duracionMinutos: number;
    minutosEnMovimiento: number;
    velocidadPromedioKmh: number;
    velocidadMaximaKmh: number;
    paradas: number;
  };
  paradas: Parada[];
  eventos: EventoGeocerca[];
  /** La forma de las zonas por las que entró o salió. */
  geocercas: Geocerca[];
}

export interface ConfiguracionFlota {
  mobiControlConfigurado: boolean;
  empresa: string | null;
  /** Key de Google Maps de la empresa en One (GOOGLE_MAPS_API_KEY). Null si no la tiene. */
  googleMaps: { apiKey: string; mapId: string | null } | null;
}

export const obtenerConfiguracion = () => obtenerJson<ConfiguracionFlota>("/api/v1/flota/configuracion");

export const obtenerFlota = (refrescar = false) =>
  obtenerJson<Flota>(`/api/v1/flota${refrescar ? "?refrescar=true" : ""}`);

export const obtenerEquipo = (deviceId: string) =>
  obtenerJson<DetalleEquipo>(`/api/v1/dispositivos/${encodeURIComponent(deviceId)}`);

export const obtenerRecorrido = (deviceId: string, desde: Date, hasta: Date) =>
  obtenerJson<Recorrido>(
    `/api/v1/dispositivos/${encodeURIComponent(deviceId)}/recorrido` +
      `?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`,
  );

export const localizarEquipo = (deviceId: string) =>
  enviarJson<{ message: string }>(`/api/v1/dispositivos/${encodeURIComponent(deviceId)}/localizar`);

/** Equipos por página: los que se muestran sin esperar y se ubican en unos segundos. */
export const TAMANO_PAGINA = 100;

export const obtenerPaginaEquipos = (skip: number, refrescar = false) =>
  obtenerJson<PaginaFlota>(`/api/v1/flota/equipos?skip=${skip}&take=${TAMANO_PAGINA}${refrescar ? "&refrescar=true" : ""}`);

export const obtenerUbicaciones = (deviceIds: string[], refrescar = false) =>
  enviarJson<UbicacionEquipo[]>(`/api/v1/flota/ubicaciones${refrescar ? "?refrescar=true" : ""}`, { deviceIds });

export const obtenerGeocercasEquipo = (deviceId: string) =>
  obtenerJson<GeocercasEquipo>(`/api/v1/dispositivos/${encodeURIComponent(deviceId)}/geocercas`);

