import { enviarJson, obtenerJson } from "./cliente";

/** Empresa a la que el usuario alcanza, según One. */
export interface EmpresaAccesible {
  empresaId: number;
  oneTenantId: string;
  slug: string;
  nombre: string;
  rol: string | null;
}

export interface Sesion {
  correo: string;
  nombre: string | null;
  esAdministradorPlataforma: boolean;
  empresas: EmpresaAccesible[];
}

/** Vínculo entre Geomonitoreo y un tenant de One. */
export interface Vinculo {
  empresaId: number;
  oneTenantId: string;
  oneSlug: string;
  nombre: string;
  oneConfigurado: boolean;
  activo: boolean;
  geocercas: number;
  fechaCreacion: string;
}

export interface VinculoCambio {
  oneTenantId: string;
  oneSlug?: string | null;
  nombre?: string | null;
  oneApiKey?: string | null;
  oneApiSecret?: string | null;
}

export interface Comprobacion {
  alcanzable: boolean;
  tenantNombre: string | null;
  tenantSlug: string | null;
  mobiControlConfigurado: boolean;
  mobiControlBaseUrl: string | null;
  configVersion: string | null;
}

export const obtenerSesion = () => obtenerJson<Sesion>("/api/v1/sesion");

export const listarVinculos = () => obtenerJson<Vinculo[]>("/api/v1/vinculos");

export const actualizarVinculo = (empresaId: number, datos: VinculoCambio) =>
  enviarJson<Vinculo>(`/api/v1/vinculos/${empresaId}`, datos, "PUT");

export const comprobarVinculo = (empresaId: number) =>
  obtenerJson<Comprobacion>(`/api/v1/vinculos/${empresaId}/comprobacion`);

export const cambiarEstadoVinculo = (empresaId: number, activo: boolean) =>
  enviarJson<{ message: string }>(`/api/v1/vinculos/${empresaId}/activo`, activo);
