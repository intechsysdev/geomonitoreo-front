const CLAVE = "geo.sesion";

/**
 * Los tokens los emite One, no el API de Geomonitoreo. Aquí se guardan junto a la empresa que el
 * usuario tiene abierta: su token puede darle acceso a varias, y el API necesita saber sobre
 * cuál está trabajando.
 */
export interface Sesion {
  accessToken: string;
  refreshToken: string;
  correo: string;
  /** Tenant de One activo. Null mientras no se haya elegido o si solo tiene uno. */
  tenantId: string | null;
}

export function leerSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: Sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    /* sin almacenamiento la sesión dura lo que la pestaña */
  }
}

export function fijarTenant(tenantId: string | null) {
  const sesion = leerSesion();
  if (sesion) guardarSesion({ ...sesion, tenantId });
}

/**
 * Avisa cuando otra pestaña de la consola cambia la sesión: entra otro usuario (por ejemplo, desde
 * la tarjeta de One), sale o elige otra empresa. Todas las pestañas leen los tokens de aquí en cada
 * petición, así que una pestaña que no se entera se queda mostrando a un usuario mientras trabaja
 * con el token de otro. Devuelve la función para dejar de escuchar.
 */
export function escucharOtrasPestanas(accion: (sesion: Sesion | null) => void): () => void {
  const alCambiar = (evento: StorageEvent) => {
    // key null: la otra pestaña vació todo el almacenamiento.
    if (evento.key === CLAVE || evento.key === null) accion(leerSesion());
  };

  window.addEventListener("storage", alCambiar);
  return () => window.removeEventListener("storage", alCambiar);
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
