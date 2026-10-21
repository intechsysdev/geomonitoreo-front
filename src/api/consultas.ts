import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData, useInfiniteQuery, useQueries, useQuery, useQueryClient, type InfiniteData,
} from "@tanstack/react-query";
import { useSesion } from "../sesion/SesionContexto";
import {
  obtenerConfiguracion, obtenerPaginaEquipos, obtenerResumenFlota, obtenerUbicaciones,
  type Equipo, type FiltroFlota, type PaginaFlota, type UbicacionEquipo,
} from "./flota";
import { listarGeocercas } from "./geocercas";

/**
 * Cada cuánto se vuelve a consultar lo que está en pantalla: las páginas cargadas, sus posiciones
 * y los totales. Los equipos reportan cada varios minutos: cada 2 minutos basta.
 */
export const REFRESCO_FLOTA_MS = 120_000;

/** Clave de la empresa activa: cada consulta es de una empresa y no debe mezclarse con otra. */
export function useEmpresaClave() {
  return useSesion().empresaActiva?.oneTenantId ?? "ninguna";
}

export function useConfiguracion() {
  const empresa = useEmpresaClave();
  return useQuery({ queryKey: ["configuracion", empresa], queryFn: obtenerConfiguracion, staleTime: 5 * 60_000 });
}

/** Cuántos equipos hay en cada estado en toda la consola, sin traerlos. */
export function useResumenFlota(activa = true) {
  const empresa = useEmpresaClave();
  return useQuery({
    queryKey: ["flota-resumen", empresa],
    queryFn: () => obtenerResumenFlota(),
    enabled: activa,
    staleTime: REFRESCO_FLOTA_MS,
    refetchInterval: REFRESCO_FLOTA_MS,
    refetchIntervalInBackground: false,
  });
}

/** El filtro tal como se usa en las claves: sin espacios de más. */
const normalizar = (f: FiltroFlota): FiltroFlota => ({
  buscar: f.buscar?.trim().replace(/\s+/g, " ") || undefined,
  estado: f.estado ?? null,
  orden: f.orden ?? "nombre",
  desc: f.desc ?? false,
});

export interface OpcionesFlota {
  activa?: boolean;
  filtro?: FiltroFlota;
  /** Pedir la última posición de los equipos cargados (el mapa la necesita; un selector, no). */
  ubicar?: boolean;
}

export interface FlotaPaginada {
  /** Lo cargado hasta ahora, con la posición de los equipos que ya se ubicaron. */
  data: { equipos: Equipo[]; consultado: string } | undefined;
  /** Cuántos equipos cumplen el filtro en toda la consola. */
  total: number | null;
  isLoading: boolean;
  isFetching: boolean;
  /** No hay nada que mostrar porque falló la primera página. */
  isError: boolean;
  error: unknown;
  /** Hay equipos cargados, pero falló una página o un refresco: se muestran los que hay. */
  aviso: string | null;
  /** Se están mostrando los resultados del filtro anterior mientras llegan los del nuevo. */
  buscando: boolean;
  hayMas: boolean;
  cargandoMas: boolean;
  /** Trae la siguiente página de 100. */
  cargarMas: () => void;
  /** Aún se están pidiendo posiciones de alguna página. */
  ubicando: boolean;
  /** Vuelve a pedir lo cargado a MobiControl, sin las copias recientes del API. */
  refrescar: () => Promise<void>;
}

/**
 * La flota de a 100 equipos. Se carga la primera página y las siguientes solo cuando se piden
 * (cargarMas): con miles de equipos, traerlos todos era lo que demoraba la pantalla y saturaba la
 * consola. Buscar, filtrar por estado u ordenar también se resuelve en MobiControl, así que no
 * hace falta tener la flota entera en el navegador.
 *
 * Las posiciones se piden aparte, de a una página a la vez (es una llamada a MobiControl por
 * equipo). El refresco va en una sola vuelta y en orden: primero las páginas y después las
 * posiciones, página por página.
 */
export function useFlota({ activa = true, filtro = {}, ubicar = true }: OpcionesFlota = {}): FlotaPaginada {
  const empresa = useEmpresaClave();
  const queryClient = useQueryClient();
  // Cuando se pide refrescar, la próxima vuelta salta las copias del API.
  const forzar = useRef(false);

  const f = normalizar(filtro);
  const claveFiltro = JSON.stringify(f);
  const clavePaginas = useMemo(() => ["flota-paginas", empresa, claveFiltro], [empresa, claveFiltro]);

  const paginas = useInfiniteQuery({
    queryKey: clavePaginas,
    queryFn: ({ pageParam }) => obtenerPaginaEquipos(f, pageParam, forzar.current),
    initialPageParam: 0,
    getNextPageParam: (ultima: PaginaFlota) => (ultima.hayMas ? ultima.skip + ultima.take : undefined),
    enabled: activa,
    staleTime: REFRESCO_FLOTA_MS,
    // Al cambiar la búsqueda se siguen viendo los resultados anteriores hasta que llegan los nuevos.
    placeholderData: keepPreviousData,
  });

  const lista = useMemo(() => paginas.data?.pages ?? [], [paginas.data]);
  const provisional = paginas.isPlaceholderData;

  // Una consulta de posiciones por página, cada una habilitada cuando terminó la anterior.
  const claveUbicaciones = useCallback(
    (skip: number) => ["flota-ubicaciones", empresa, claveFiltro, skip],
    [empresa, claveFiltro],
  );

  // Los equipos de una página, leídos del caché al momento de pedir: tras refrescar las páginas,
  // las posiciones se piden para los equipos que hay ahora.
  const idsDe = useCallback(
    (skip: number) =>
      (queryClient.getQueryData<InfiniteData<PaginaFlota>>(clavePaginas)?.pages ?? [])
        .find((p) => p.skip === skip)
        ?.equipos.filter((e) => e.tieneGps)
        .map((e) => e.deviceId) ?? [],
    [queryClient, clavePaginas],
  );

  const ubicaciones = useQueries({
    queries: (provisional ? [] : lista).map((pagina, i) => {
      const anterior = i === 0 ? null : queryClient.getQueryState(claveUbicaciones(lista[i - 1].skip));
      return {
        queryKey: claveUbicaciones(pagina.skip),
        queryFn: () => obtenerUbicaciones(idsDe(pagina.skip), forzar.current),
        enabled:
          activa && ubicar && pagina.equipos.some((e) => e.tieneGps) &&
          (i === 0 || anterior?.status === "success" || anterior?.status === "error"),
        // Solo se vuelven a pedir en la vuelta de refresco, nunca por su cuenta.
        staleTime: Infinity,
        refetchOnMount: false,
      };
    }),
  });

  // Toda posición conocida de la empresa, aunque sea de otra búsqueda: un equipo que ya se ubicó
  // no pierde su punto mientras llega la página del filtro nuevo.
  const versionUbicaciones = ubicaciones.map((u) => u.dataUpdatedAt).join(",");
  const posiciones = useMemo(() => {
    const mapa = new Map<string, UbicacionEquipo>();
    for (const [, datos] of queryClient.getQueriesData<UbicacionEquipo[]>({ queryKey: ["flota-ubicaciones", empresa] }))
      for (const p of datos ?? []) {
        const actual = mapa.get(p.deviceId);
        if (!actual || actual.momento < p.momento) mapa.set(p.deviceId, p);
      }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, empresa, versionUbicaciones, lista]);

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
          await queryClient.refetchQueries({ queryKey: clavePaginas, exact: true });
          await queryClient.refetchQueries({ queryKey: ["flota-resumen", empresa], exact: true });
          if (ubicar) {
            const ahora = queryClient.getQueryData<InfiniteData<PaginaFlota>>(clavePaginas)?.pages ?? [];
            for (const p of ahora) await queryClient.refetchQueries({ queryKey: claveUbicaciones(p.skip), exact: true });
          }
        } finally {
          forzar.current = false;
          enCurso.current = null;
        }
      })();
      enCurso.current = tarea;
      return tarea;
    },
    [queryClient, clavePaginas, claveUbicaciones, empresa, ubicar],
  );

  // Cada dos minutos, mientras la pestaña está a la vista.
  const cargado = !paginas.isPending;
  useEffect(() => {
    if (!activa || !cargado) return;
    const id = setInterval(() => {
      if (!document.hidden) void vuelta(false);
    }, REFRESCO_FLOTA_MS);
    return () => clearInterval(id);
  }, [activa, cargado, vuelta]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = paginas;
  const cargarMas = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refrescar = useCallback(() => vuelta(true), [vuelta]);

  return {
    data,
    total: lista[0]?.total ?? null,
    isLoading: paginas.isLoading,
    isFetching: paginas.isFetching || ubicaciones.some((u) => u.isFetching),
    isError: paginas.isError && !lista.length,
    error: paginas.error,
    aviso: paginas.isError && lista.length
      ? `No se pudo traer de MobiControl (${(paginas.error as Error)?.message ?? "error"}). Se muestran los equipos ya cargados.`
      : null,
    buscando: provisional,
    hayMas: !!hasNextPage,
    cargandoMas: isFetchingNextPage,
    cargarMas,
    ubicando: ubicaciones.some((u) => u.isFetching || (u.isPending && u.fetchStatus !== "idle")),
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

/** El valor con una pausa: para buscar en MobiControl cuando se deja de escribir, no en cada tecla. */
export function useConPausa<T>(valor: T, ms = 400): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    // Borrar la búsqueda se aplica de una: no hay nada que esperar.
    const id = setTimeout(() => setDiferido(valor), valor === "" ? 0 : ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return diferido;
}
