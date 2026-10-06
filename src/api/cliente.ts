import { borrarSesion, guardarSesion, leerSesion } from "./sesionAlmacenada";

/**
 * Dos destinos distintos:
 *
 * - ONE emite y renueva los tokens, y es donde viven empresas, usuarios y configuración.
 * - BASE es el API de Geomonitoreo, que no tiene usuarios propios: solo verifica los tokens de One.
 *
 * En desarrollo BASE queda vacío y Vite reenvía /api; en producción lleva la URL absoluta.
 */
const BASE = import.meta.env.VITE_API_URL ?? "";

/** URL completa de una ruta del API, para las llamadas que no llevan sesión. */
export const urlApi = (ruta: string) => `${BASE}${ruta}`;
const ONE = (import.meta.env.VITE_ONE_URL ?? "").replace(/\/+$/, "");

export class ErrorApi extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Se dispara cuando la sesión deja de servir, para que la app vuelva al login. */
let alPerderSesion: (() => void) | null = null;
export function avisarAlPerderSesion(accion: () => void) {
  alPerderSesion = accion;
}

export async function mensajeDeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = await respuesta.json();
    return cuerpo?.message ?? cuerpo?.detail ?? cuerpo?.title ?? `El servidor respondió ${respuesta.status}.`;
  } catch {
    return `El servidor respondió ${respuesta.status}.`;
  }
}

/**
 * El token de acceso de One dura una hora. Antes de dar una sesión por perdida se intenta una
 * vez con el de refresco, que además rota: reutilizar uno ya rotado revoca todas las sesiones,
 * así que solo se intenta una vez y se guarda el nuevo de inmediato.
 */
async function renovar(): Promise<boolean> {
  const sesion = leerSesion();
  if (!sesion?.refreshToken) return false;

  const respuesta = await fetch(`${ONE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: sesion.refreshToken }),
  });

  if (!respuesta.ok) return false;

  const datos = await respuesta.json();
  guardarSesion({ ...sesion, accessToken: datos.accessToken, refreshToken: datos.refreshToken });
  return true;
}

async function pedir(ruta: string, opciones: RequestInit, reintentar = true): Promise<Response> {
  const sesion = leerSesion();
  const cabeceras = new Headers(opciones.headers);

  if (sesion?.accessToken) cabeceras.set("Authorization", `Bearer ${sesion.accessToken}`);

  // Sin esto, un usuario que pertenece a varias empresas no tendría ninguna resuelta y el API
  // no sabría qué datos mostrarle.
  if (sesion?.tenantId) cabeceras.set("X-Tenant-Id", sesion.tenantId);

  const respuesta = await fetch(`${BASE}${ruta}`, { ...opciones, headers: cabeceras });

  if (respuesta.status === 401 && reintentar) {
    if (await renovar()) return pedir(ruta, opciones, false);

    borrarSesion();
    alPerderSesion?.();
  }

  return respuesta;
}

export async function obtenerJson<T>(ruta: string): Promise<T> {
  const respuesta = await pedir(ruta, { method: "GET" });
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, await mensajeDeError(respuesta));
  return (await respuesta.json()) as T;
}

export async function enviarJson<T>(
  ruta: string,
  cuerpo?: unknown,
  metodo: "POST" | "PUT" | "DELETE" = "POST",
): Promise<T> {
  const respuesta = await pedir(ruta, {
    method: metodo,
    headers: cuerpo === undefined ? {} : { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  if (!respuesta.ok) throw new ErrorApi(respuesta.status, await mensajeDeError(respuesta));

  // 204 (borrar) no trae cuerpo.
  const texto = await respuesta.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

/**
 * Descarga un archivo protegido y lo entrega como URL de objeto. Se hace así y no con un
 * <img src> o un enlace directo porque el token viaja en la cabecera: en la URL quedaría
 * escrito en el historial del navegador y en los registros del servidor.
 */
export async function obtenerArchivo(ruta: string): Promise<string> {
  const respuesta = await pedir(ruta, { method: "GET" });
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, await mensajeDeError(respuesta));
  return URL.createObjectURL(await respuesta.blob());
}

/**
 * Pregunta a One si la sesión sigue abierta. Cerrar sesión en el portal cierra también esta, pero
 * una pantalla quieta no hace peticiones y no se enteraría: la consola lo pregunta al volver a la
 * pestaña y cada tanto. Un token vencido se renueva; una sesión cerrada vuelve al login. Sin red
 * no se concluye nada.
 */
export async function verificarSesion(): Promise<void> {
  const sesion = leerSesion();
  if (!sesion?.accessToken) return;

  const preguntar = (token: string) =>
    fetch(`${ONE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });

  try {
    if ((await preguntar(sesion.accessToken)).status !== 401) return;
    if (await renovar()) return;
  } catch {
    return;
  }

  borrarSesion();
  alPerderSesion?.();
}

/**
 * Revoca en One el token de refresco de esta sesión. Sin esto, al salir el token seguía vivo
 * hasta vencer. Lee la sesión antes del primer await: quien llama la borra justo después.
 * Si One no responde no pasa nada: la sesión se cierra igual en el navegador.
 */
export async function revocarSesion(): Promise<void> {
  const sesion = leerSesion();
  if (!sesion?.refreshToken) return;

  try {
    await fetch(`${ONE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sesion.accessToken}` },
      body: JSON.stringify({ refreshToken: sesion.refreshToken }),
      // Que salga aunque la página se recargue enseguida.
      keepalive: true,
    });
  } catch {
    /* sin red: el token vence solo */
  }
}

/** El login es contra One: el API de Geomonitoreo no emite credenciales. */
export async function iniciarSesion(correo: string, clave: string): Promise<void> {
  const respuesta = await fetch(`${ONE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: clave }),
  });

  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      respuesta.status === 401 ? "Correo o contraseña incorrectos." : await mensajeDeError(respuesta),
    );
  }

  const datos = await respuesta.json();

  guardarSesion({
    accessToken: datos.accessToken,
    refreshToken: datos.refreshToken,
    correo,
    tenantId: null,
  });
}
