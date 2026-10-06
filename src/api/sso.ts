import { ErrorApi, mensajeDeError } from "./cliente";
import { guardarSesion } from "./sesionAlmacenada";

/**
 * Entrada con One (inicio de sesión único). Es el flujo "authorization code" de OAuth 2.0 con
 * PKCE, que es el indicado para una app que corre entera en el navegador y no puede guardar un
 * secreto:
 *
 * 1. Aquí se genera un verificador al azar y se manda al usuario al portal de One con su resumen.
 * 2. One, que ya tiene la sesión del usuario, lo devuelve a /sso/callback con un código.
 * 3. El código se canjea presentando el verificador, que nunca salió de esta pestaña.
 *
 * El resultado es la misma sesión de One que da el login con contraseña, así que el resto de la
 * consola no distingue por dónde entró el usuario.
 */

const ONE = (import.meta.env.VITE_ONE_URL ?? "").replace(/\/+$/, "");
const PORTAL = (import.meta.env.VITE_ONE_PORTAL_URL ?? "").replace(/\/+$/, "");
const CLIENTE = import.meta.env.VITE_ONE_CLIENT_ID ?? "geomonitoreo";

/** El verificador vive en sessionStorage: solo esta pestaña lo conoce, y muere con ella. */
const CLAVE_TRANSACCION = "geo.sso";

interface Transaccion {
  verificador: string;
  estado: string;
}

const retorno = () => `${window.location.origin}/sso/callback`;

function aleatorio(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function reto(verificador: string): Promise<string> {
  const resumen = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador));
  return base64Url(new Uint8Array(resumen));
}

/** Sin la dirección del portal no hay a dónde mandar al usuario: el botón ni se muestra. */
export const ssoDisponible = () => PORTAL !== "" && ONE !== "";

/**
 * Manda al usuario al portal de One. La empresa, si viene, es la que eligió en One al abrir la
 * app: se reenvía para que One compruebe que tiene acceso por ella y para dejarla elegida aquí.
 */
export async function iniciarSso(tenantId?: string | null, elegirCuenta = false): Promise<void> {
  const transaccion: Transaccion = { verificador: aleatorio(32), estado: aleatorio(16) };
  sessionStorage.setItem(CLAVE_TRANSACCION, JSON.stringify(transaccion));

  const destino = new URL(`${PORTAL}/autorizar`);
  destino.searchParams.set("client_id", CLIENTE);
  destino.searchParams.set("redirect_uri", retorno());
  destino.searchParams.set("code_challenge", await reto(transaccion.verificador));
  destino.searchParams.set("code_challenge_method", "S256");
  destino.searchParams.set("state", transaccion.estado);
  if (tenantId) destino.searchParams.set("tenant", tenantId);
  // Desde el login de la consola no se entra en silencio con quien tenga la sesión abierta en
  // One: quien acaba de salir quizá quiere entrar con otra cuenta. One pregunta con cuál seguir.
  if (elegirCuenta) destino.searchParams.set("prompt", "select_account");

  // replace: el botón Atrás desde One no debe volver a esta página de paso y arrancar otro intento.
  window.location.replace(destino.toString());
}

/** Canjea el código que devolvió One y deja la sesión guardada como la del login normal. */
export async function completarSso(params: URLSearchParams): Promise<void> {
  const codigo = params.get("code");
  const estado = params.get("state");

  let transaccion: Transaccion | null = null;
  try {
    transaccion = JSON.parse(sessionStorage.getItem(CLAVE_TRANSACCION) ?? "null") as Transaccion | null;
  } catch {
    transaccion = null;
  }
  sessionStorage.removeItem(CLAVE_TRANSACCION);

  // El estado ata la vuelta a la ida desde esta misma pestaña. Sin él, alguien podría mandarle a
  // otro un enlace con un código suyo y dejarlo trabajando, sin darse cuenta, en su sesión.
  if (!codigo || !transaccion || estado !== transaccion.estado) {
    throw new Error("El inicio de sesión con One no se pudo completar. Vuelve a intentarlo desde el principio.");
  }

  const respuesta = await fetch(`${ONE}/api/v1/sso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: CLIENTE,
      code: codigo,
      codeVerifier: transaccion.verificador,
      redirectUri: retorno(),
    }),
  });

  if (!respuesta.ok) throw new ErrorApi(respuesta.status, await mensajeDeError(respuesta));

  const datos = await respuesta.json();

  guardarSesion({
    accessToken: datos.accessToken,
    refreshToken: datos.refreshToken,
    correo: datos.user.email,
    tenantId: datos.tenantId ?? params.get("tenant") ?? null,
  });
}
