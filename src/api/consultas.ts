import { useQuery } from "@tanstack/react-query";
import { useSesion } from "../sesion/SesionContexto";
import { obtenerConfiguracion, obtenerFlota } from "./flota";
import { listarGeocercas } from "./geocercas";

/** La flota se refresca sola: los equipos reportan cada pocos minutos y el API cachea 25 s. */
export const REFRESCO_FLOTA_MS = 30_000;

/** Clave de la empresa activa: cada consulta es de una empresa y no debe mezclarse con otra. */
export function useEmpresaClave() {
  return useSesion().empresaActiva?.oneTenantId ?? "ninguna";
}

export function useConfiguracion() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["configuracion", empresa], queryFn: obtenerConfiguracion, staleTime: 5 * 60_000 });
}

export function useFlota(activa = true) {
  const empresa = useEmpresaClave();
  return useQuery({
    queryKey: ["flota", empresa],
    queryFn: () => obtenerFlota(),
    enabled: activa,
    refetchInterval: REFRESCO_FLOTA_MS,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

/** La lista completa, con si se pudo sincronizar con MobiControl. */
export function useListaGeocercas() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["geocercas", empresa], queryFn: listarGeocercas, staleTime: 60_000 });
}

/** Solo las geocercas, para las pantallas que las dibujan o las nombran. */
export function useGeocercas() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["geocercas", empresa], queryFn: listarGeocercas, staleTime: 60_000, select: (d) => d.geocercas });
}
