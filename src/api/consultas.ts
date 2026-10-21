import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueries, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSesion } from "../sesion/SesionContexto";
import {
  obtenerConfiguracion, obtenerPaginaEquipos, obtenerUbicaciones, type Equipo, type PaginaFlota, type UbicacionEquipo,
} from "./flota";
import { listarGeocercas } from "./geocercas";

/**
 * Cada cuánto se vuelve a consultar la flota. Con miles de equipos, cada vuelta son varias páginas
 * y una consulta de posición por equipo (el API las cachea 90 s): cada 2 minutos basta, porque los
 * equipos reportan cada varios minutos.
 */
export const REFRESCO_FLOTA_MS = 120_000;

/** Espera antes de volver a pedir una página que falló. */
const REINTENTO_PAGINA_MS = 15_000;

/** Clave de la empresa activa: cada consulta es de una empresa y no debe mezclarse con otra. */
export function useEmpresaClave() {
  return useSesion().empresaActiva?.oneTenantId ?? "ninguna";
}

export function useConfiguracion() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["configuracion", empresa], queryFn: obtenerConfiguracion, staleTime: 5 * 60_000 });
}

export interface FlotaProgresiva {
  /** Lo cargado hasta ahora, con la posición de los equipos que ya se ubicaron. */
  data: { equipos: Equipo[]; consultado: string } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  /** No hay nada que mostrar porque falló la primera página. */
  isError: boolean;
  error: unknown;
  /** Hay equipos cargados, pero falló una página o un refresco: se muestran los que hay y se reintenta solo. */
  aviso: string | null;
  /** Ya están todas las páginas de equipos (las posiciones pueden seguir llegando). */
  completo: boolean;
  /** Aún se están pidiendo posiciones de alguna página. */
  ubicando: boolean;
  /** Vuelve a pedir todo a MobiControl, sin las copias recientes del API. */
  refrescar: () => Promise<void>;
}

/**
 * La flota por páginas de 100 equipos, ordenadas por nombre. La primera página se muestra en
 * cuanto llega y las siguientes se piden solas, una tras otra. Las posiciones se piden aparte, de
 * a una página a la vez: es una llamada a MobiControl por equipo, y pedirlas todas juntas era lo
 * que demoraba la pantalla con miles de equipos.
 *
 * El refresco también va en orden, en una sola vuelta: primero las páginas y después las
 * posiciones página por página. Con un temporizador por página, a los dos minutos se disparaban
 * todas a la vez (miles de llamadas juntas) y la consola respondía 500.
 */
export function useFlota(activa = true): FlotaProgresiva {
  const empresa = useEmpresaClave();
  const queryClient = useQueryClient();
  // Cuando se pide refrescar, la próxima vuelta salta las copias del API.
  const forzar = useRef(false);

  const paginas = useInfiniteQuery({
    queryKey: ["flota-paginas", empresa],
    queryFn: ({ pageParam }) => obtenerPaginaEquipos(pageParam, forzar.current),
    initialPageParam: 0,
    getNextPageParam: (ultima: PaginaFlota) => (ultima.hayMas ? ultima.skip + ultima.take : undefined),
    enabled: activa,
    staleTime: REFRESCO_FLOTA_MS,
  });

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = paginas;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (!isError) {
      void fetchNextPage();
      return;
    }
    // Una página que falló (la consola ocupada) se vuelve a pedir en un rato, sin perder lo cargado.
    const id = setTimeout(() => void fetchNextPage(), REINTENTO_PAGINA_MS);
    return () => clearTimeout(id);
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const lista = useMemo(() => paginas.data?.pages ?? [], [paginas.data]);

  // Una consulta de posiciones por página, cada una habilitada cuando terminó la anterior.
  const idsPorPagina = useMemo(
    () => lista.map((p) => p.equipos.filter((e) => e.tieneGps).map((e) => e.deviceId)),
    [lista],
  );
  const claveDe = (skip: number | undefined) => ["flota-ubicaciones", empresa, skip];

  // Los equipos de una página, leídos del caché al momento de pedir: tras refrescar las páginas,
  // las posiciones se piden para los equipos que hay ahora.
  const idsDe = useCallback(
    (skip: number) =>
      (queryClient.getQueryData<InfiniteData<PaginaFlota>>(["flota-paginas", empresa])?.pages ?? [])
        .find((p) => p.skip === skip)
        ?.equipos.filter((e) => e.tieneGps)
        .map((e) => e.deviceId) ?? [],
    [queryClient, empresa],
  );

  const ubicaciones = useQueries({
    queries: idsPorPagina.map((ids, i) => {
      const skip = lista[i].skip;
      const anterior = i === 0 ? null : queryClient.getQueryState(claveDe(lista[i - 1].skip));
      return {
        queryKey: claveDe(skip),
        queryFn: () => obtenerUbicaciones(idsDe(skip), forzar.current),
        enabled: activa && ids.length > 0 && (i === 0 || anterior?.status === "success" || anterior?.status === "error"),
        // Solo se vuelven a pedir en la vuelta de refresco, nunca por su cuenta.
        staleTime: Infinity,
        refetchOnMount: false,
      };
    }),
  });

  const posiciones = useMemo(() => {
    const mapa = new Map<string, UbicacionEquipo>();
    for (const u of ubicaciones) for (const p of u.data ?? []) mapa.set(p.deviceId, p);
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicaciones.map((u) => u.dataUpdatedAt).join(",")]);

  const data = useMemo(() => {
    if (!lista.length) return undefined;
    const equipos = lista.flatMap((p) => p.equipos).map((e) => {
      const u = posiciones.get(e.deviceId);
      return u
        ? { ...e, latitud: u.latitud, longitud: u.longitud, fechaUbicacion: u.momento, velocidad: u.velocidad, rumbo: u.rumbo, geocercas: u.geocercas }
        : e;
    });
    return { equipos, consultado: lista[0].consultado };
  }, [lista, posiciones]);

  // Una vuelta de refresco a la vez, y en orden.
  const enCurso = useRef<Promise<void> | null>(null);
  const vuelta = useCallback(
    (sinCopias: boolean) => {
      if (enCurso.current) return enCurso.current;
      const tarea = (async () => {
        forzar.current = sinCopias;
        try {
          await queryClient.refetchQueries({ queryKey: ["flota-paginas", empresa], exact: true });
          const paginasAhora = queryClient.getQueryData<InfiniteData<PaginaFlota>>(["flota-paginas", empresa])?.pages ?? [];
          for (const p of paginasAhora) await queryClient.refetchQueries({ queryKey: claveDe(p.skip), exact: true });
        } finally {
          forzar.current = false;
          enCurso.current = null;
        }
      })();
      enCurso.current = tarea;
      return tarea;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, empresa],
  );

  // Cada dos minutos, mientras la pestaña está a la vista y la carga inicial terminó.
  const cargado = !paginas.hasNextPage && !paginas.isPending;
  useEffect(() => {
    if (!activa || !cargado) return;
    const id = setInterval(() => {
      if (!document.hidden) void vuelta(false);
    }, REFRESCO_FLOTA_MS);
    return () => clearInterval(id);
  }, [activa, cargado, vuelta]);

  const refrescar = useCallback(() => vuelta(true), [vuelta]);

  return {
    data,
    isLoading: paginas.isLoading,
    isFetching: paginas.isFetching || ubicaciones.some((u) => u.isFetching),
    isError: paginas.isError && !lista.length,
    error: paginas.error,
    aviso: paginas.isError && lista.length
      ? `No se pudieron traer todos los equipos (${(paginas.error as Error)?.message ?? "error"}). Se reintenta solo.`
      : null,
    completo: !paginas.hasNextPage && !paginas.isFetchingNextPage && !paginas.isLoading,
    ubicando: ubicaciones.some((u) => u.isPending && u.fetchStatus !== "idle") || ubicaciones.some((u) => u.isFetching),
    refrescar,
  };
}

/** La lista completa, con si se pudo sincronizar con MobiControl. Para la pantalla de geocercas. */
export function useListaGeocercas() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["geocercas", empresa], queryFn: listarGeocercas, staleTime: 60_000 });
}

/** Solo las geocercas, para las pantallas que las nombran. */
export function useGeocercas() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["geocercas", empresa], queryFn: listarGeocercas, staleTime: 60_000, select: (d) => d.geocercas });
}
