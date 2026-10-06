import type { Equipo } from "./api/flota";

const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "short" });

/** "hace 3 min", "hace 2 h", "ayer"… */
export function haceCuanto(fecha: string | Date | null | undefined, ahora = Date.now()): string {
  if (!fecha) return "Sin reporte";
  const segundos = Math.round((new Date(fecha).getTime() - ahora) / 1000);
  const abs = Math.abs(segundos);

  if (abs < 45) return "ahora";
  if (abs < 3600) return relativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return relativo.format(Math.round(segundos / 3600), "hour");
  if (abs < 86400 * 30) return relativo.format(Math.round(segundos / 86400), "day");
  // En corto, "hace 2 m." (meses) se confunde con minutos: lo largo se lee sin dudar.
  if (abs < 86400 * 365) return relativoLargo.format(Math.round(segundos / (86400 * 30)), "month");
  return relativoLargo.format(Math.round(segundos / (86400 * 365)), "year");
}

const relativoLargo = new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "long" });

const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const hora = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

export const formatoFechaHora = (fecha: string | Date | null | undefined) =>
  fecha ? fechaHora.format(new Date(fecha)) : "—";

export const formatoHora = (fecha: string | Date) => hora.format(new Date(fecha));

export function duracion(minutos: number): string {
  if (minutos < 1) return "< 1 min";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const coordenadas = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/** Estado operativo de un equipo, el mismo en el mapa, la lista y la tabla. */
export type EstadoEquipo = "en-linea" | "inactivo" | "sin-senal";

/** Más de un día sin reportarse es un equipo perdido o apagado, no uno descansando. */
const UMBRAL_SIN_SENAL_MS = 24 * 3600 * 1000;

export function estadoDe(equipo: Pick<Equipo, "enLinea" | "ultimoReporte">, ahora = Date.now()): EstadoEquipo {
  if (equipo.enLinea) return "en-linea";
  if (!equipo.ultimoReporte || ahora - new Date(equipo.ultimoReporte).getTime() > UMBRAL_SIN_SENAL_MS) return "sin-senal";
  return "inactivo";
}

export const NOMBRE_ESTADO: Record<EstadoEquipo, string> = {
  "en-linea": "En línea",
  inactivo: "Inactivo",
  "sin-senal": "Sin señal +24 h",
};

export const bateriaBaja = (equipo: Pick<Equipo, "bateria" | "cargando">) =>
  equipo.bateria !== null && equipo.bateria <= 20 && !equipo.cargando;

/** Sin la ruta de carpetas de MobiControl: "\\Empresa\\Ventas\\Cali" → "Ventas / Cali". */
export function grupoCorto(grupo: string | null): string | null {
  if (!grupo) return null;
  const partes = grupo.split(/[\\/]+/).filter(Boolean);
  return partes.length > 1 ? partes.slice(1).join(" / ") : partes.join(" / ");
}
