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

/** Una página de la flota, buscada y ordenada en MobiControl. Los equipos vienen sin posición. */
export interface PaginaFlota {
  equipos: Equipo[];
  skip: number;
  take: number;
  /** Cuántos equipos cumplen la búsqueda en toda la consola. */
  total: number;
  hayMas: boolean;
  consultado: string;
}

/** Estados que la consola sabe filtrar. */
export type EstadoFiltro = "en-linea" | "inactivo" | "sin-senal" | "bateria";

export type OrdenFlota = "nombre" | "estado" | "modelo" | "bateria" | "ultimoReporte";

/** Qué equipos traer: se busca, filtra y ordena en MobiControl, no en el navegador. */
export interface FiltroFlota {
  /** Dentro del nombre, modelo, fabricante, serial o DeviceId. */
  buscar?: string;
  estado?: EstadoFiltro | null;
  orden?: OrdenFlota;
  desc?: boolean;
}

/** Cuántos equipos hay en cada estado, en toda la consola. */
export interface ResumenFlota {
  total: number;
  enLinea: number;
  inactivos: number;
  sinSenal: number;
  bateriaBaja: number;
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

function parametros(filtro: FiltroFlota, extra: Record<string, string | number | boolean | undefined> = {}) {
  const q = new URLSearchParams();
  const buscar = filtro.buscar?.trim();
  if (buscar) q.set("buscar", buscar);
  if (filtro.estado) q.set("estado", filtro.estado);
  if (filtro.orden && filtro.orden !== "nombre") q.set("orden", filtro.orden);
  if (filtro.desc) q.set("desc", "true");
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== false) q.set(k, String(v));
  return q.toString();
}

export const obtenerPaginaEquipos = (filtro: FiltroFlota, skip: number, refrescar = false) =>
  obtenerJson<PaginaFlota>(`/api/v1/flota/equipos?${parametros(filtro, { skip, take: TAMANO_PAGINA, refrescar })}`);

export const obtenerResumenFlota = (refrescar = false) =>
  obtenerJson<ResumenFlota>(`/api/v1/flota/resumen${refrescar ? "?refrescar=true" : ""}`);

/** Todos los equipos que cumplen el filtro, para exportar. Con la posición que ya se conozca. */
export const exportarEquipos = (filtro: FiltroFlota) =>
  obtenerJson<Equipo[]>(`/api/v1/flota/equipos/exportar?${parametros(filtro)}`);

export const obtenerUbicaciones = (deviceIds: string[], refrescar = false) =>
  enviarJson<UbicacionEquipo[]>(`/api/v1/flota/ubicaciones${refrescar ? "?refrescar=true" : ""}`, { deviceIds });

export const obtenerGeocercasEquipo = (deviceId: string) =>
  obtenerJson<GeocercasEquipo>(`/api/v1/dispositivos/${encodeURIComponent(deviceId)}/geocercas`);

