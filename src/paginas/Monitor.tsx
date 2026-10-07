import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BatteryWarning, Copy, Crosshair, ExternalLink, MapPinOff, RefreshCw, Route, Search, Signal, SignalZero, Wifi, X,
} from "lucide-react";
import { localizarEquipo, obtenerEquipo, obtenerFlota, type Equipo } from "../api/flota";
import { useConfiguracion, useEmpresaClave, useFlota, useGeocercas } from "../api/consultas";
import { Aviso, Bateria, Cargando, PuntoEstado } from "../componentes/Basicos";
import { AvisoMapa, ControlesMapa } from "../mapa/ControlesMapa";
import { BuscadorDirecciones, type Lugar } from "../mapa/BuscadorDirecciones";
import { CapaFlota, CapaGeocercas, elemento, encuadrar as encuadrarMapa, irA, marcador, quitarMarcadores, type Margen } from "../mapa/capas";
import { distancia } from "../mapa/geo";
import type { FondoMapa } from "../mapa/estilos";
import { useMapa } from "../mapa/useMapa";
import {
  bateriaBaja, coordenadas, estadoDe, formatoFechaHora, grupoCorto, haceCuanto, NOMBRE_ESTADO, type EstadoEquipo,
} from "../formato";

type Filtro = "todos" | EstadoEquipo | "bateria" | "sin-ubicacion";

const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: "todos", nombre: "Todos" },
  { id: "en-linea", nombre: "En línea" },
  { id: "inactivo", nombre: "Inactivos" },
  { id: "sin-senal", nombre: "Sin señal" },
  { id: "bateria", nombre: "Batería baja" },
  { id: "sin-ubicacion", nombre: "Sin ubicación" },
];

function cumple(e: Equipo, filtro: Filtro, ahora: number) {
  switch (filtro) {
    case "todos": return true;
    case "bateria": return bateriaBaja(e);
    case "sin-ubicacion": return e.latitud === null;
    default: return estadoDe(e, ahora) === filtro;
  }
}

/** El reloj de "hace X" avanza solo, sin volver a pedir datos. */
function useAhora(cadaMs = 15_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

export function Monitor() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [fondo, setFondo] = useState<FondoMapa>("mapa");
  const { mapa, aviso } = useMapa(contenedor, fondo);
  const [params, setParams] = useSearchParams();
  const seleccionado = params.get("equipo");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [verZonas, setVerZonas] = useState(true);
  const ahora = useAhora();
  const queryClient = useQueryClient();
  const empresa = useEmpresaClave();

  const configuracion = useConfiguracion();
  const configurado = configuracion.data?.mobiControlConfigurado ?? false;
  const flota = useFlota(configurado);
  const geocercas = useGeocercas();
  const equipos = useMemo(() => flota.data?.equipos ?? [], [flota.data]);

  const elegir = useCallback(
    (id: string | null) => {
      setParams((p) => {
        const siguiente = new URLSearchParams(p);
        if (id) siguiente.set("equipo", id);
        else siguiente.delete("equipo");
        return siguiente;
      }, { replace: true });
    },
    [setParams],
  );

  // ---- Capas ----
  const [capas, setCapas] = useState<{ flota: CapaFlota; zonas: CapaGeocercas } | null>(null);

  useEffect(() => {
    if (!mapa) return;
    const zonas = new CapaGeocercas(mapa, { opacidad: 0.12 });
    const flota = new CapaFlota(mapa, (id) => elegir(id));
    setCapas({ flota, zonas });
    return () => {
      zonas.quitar();
      flota.quitar();
      setCapas(null);
    };
  }, [mapa, elegir]);

  useEffect(() => {
    capas?.flota.poner(equipos);
  }, [capas, equipos]);

  useEffect(() => {
    const activas = (geocercas.data ?? []).filter((g) => g.activa);
    capas?.zonas.poner(verZonas ? activas : []);
  }, [capas, geocercas.data, verZonas]);

  // ---- Encuadre: la primera vez que llegan equipos, que se vean todos ----
  const encuadrado = useRef(false);
  const encuadrar = useCallback(() => {
    const puntos = equipos.filter((e) => e.latitud !== null).map((e) => [e.longitud!, e.latitud!] as [number, number]);
    if (mapa) encuadrarMapa(mapa, puntos, MARGEN, 14);
  }, [mapa, equipos]);

  useEffect(() => {
    if (encuadrado.current || !mapa || equipos.length === 0 || seleccionado) return;
    encuadrado.current = true;
    encuadrar();
  }, [mapa, equipos, encuadrar, seleccionado]);

  // ---- Equipo elegido: centrarlo y marcarlo con un pulso ----
  const elegido = equipos.find((e) => e.deviceId === seleccionado) ?? null;
  const latElegido = elegido?.latitud ?? null;
  const lngElegido = elegido?.longitud ?? null;
  const estadoElegido = elegido ? estadoDe(elegido) : null;

  useEffect(() => {
    if (!mapa || latElegido === null || lngElegido === null || !estadoElegido) return;
    const pulso = marcador(mapa, [lngElegido, latElegido], elemento("pulso", undefined, { estado: estadoElegido }), { zIndex: 2000 });
    return () => quitarMarcadores(pulso);
  }, [mapa, latElegido, lngElegido, estadoElegido]);

  const ultimoCentrado = useRef<string | null>(null);
  useEffect(() => {
    if (!mapa || !elegido || elegido.latitud === null || ultimoCentrado.current === elegido.deviceId) return;
    ultimoCentrado.current = elegido.deviceId;
    // A la izquierda del centro: a la derecha va el cajón del detalle.
    irA(mapa, [elegido.longitud!, elegido.latitud!], Math.max(mapa.getZoom() ?? 0, 15), 180);
  }, [mapa, elegido]);

  // ---- Lista ----
  const conteos = useMemo(() => {
    const c = Object.fromEntries(FILTROS.map((f) => [f.id, 0])) as Record<Filtro, number>;
    for (const e of equipos) for (const f of FILTROS) if (cumple(e, f.id, ahora)) c[f.id]++;
    return c;
  }, [equipos, ahora]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return equipos.filter(
      (e) =>
        cumple(e, filtro, ahora) &&
        (!texto || [e.nombre, e.modelo, e.fabricante, e.imei, e.telefono, e.serial, e.grupo]
          .some((v) => v?.toLowerCase().includes(texto))),
    );
  }, [equipos, filtro, busqueda, ahora]);

  const refrescar = useMutation({
    mutationFn: () => obtenerFlota(true),
    onSuccess: (datos) => queryClient.setQueryData(["flota", empresa], datos),
  });

  // ---- Estados de la pantalla ----
  let superpuesto: React.ReactNode = null;
  if (configuracion.isLoading) superpuesto = <Cargando texto="Conectando con la consola…" />;
  else if (configuracion.isError) superpuesto = <Aviso tipo="error">{(configuracion.error as Error).message}</Aviso>;
  else if (!configurado)
    superpuesto = (
      <Aviso tipo="alerta">
        <strong>{configuracion.data?.empresa ?? "Esta empresa"}</strong> todavía no tiene su consola de MobiControl
        configurada. Un administrador debe cargarla en Intechsys One, en la app Geomonitoreo → Variables.
      </Aviso>
    );
  else if (flota.isError) superpuesto = <Aviso tipo="error">{(flota.error as Error).message}</Aviso>;

  return (
    <div className="pantalla-mapa">
      <div ref={contenedor} className="mapa" />
      <AvisoMapa texto={aviso} />

      <BuscadorDirecciones
        mapa={mapa}
        margen={MARGEN}
        acciones={(lugar) => <EquiposCerca lugar={lugar} equipos={equipos} alElegir={elegir} />}
      />

      <aside className="panel-flota vidrio" aria-label="Flota">
        <div className="panel-cabeza">
          <div>
            <h1>Monitor en vivo</h1>
            <p className="suave chico">
              {flota.data ? (
                <>Actualizado {haceCuanto(flota.data.consultado, ahora)} · {equipos.length} equipos</>
              ) : (
                "Flota de MobiControl"
              )}
            </p>
          </div>
          <button
            type="button"
            className="boton fantasma chico icono"
            aria-label="Actualizar ahora"
            title="Actualizar ahora"
            disabled={refrescar.isPending || !configurado}
            onClick={() => refrescar.mutate()}
          >
            <RefreshCw aria-hidden className={refrescar.isPending || flota.isFetching ? "girando" : undefined} />
          </button>
        </div>

        <div className="kpis" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="kpi"
              data-filtro={f.id}
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
            >
              <span className="kpi-numero">{conteos[f.id]}</span>
              <span className="kpi-nombre">{f.nombre}</span>
            </button>
          ))}
        </div>

        <label className="buscador">
          <span className="visualmente-oculto">Buscar equipo</span>
          <Search aria-hidden />
          <input
            className="campo"
            type="search"
            placeholder="Nombre, IMEI, teléfono, grupo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>

        {superpuesto ?? (flota.isLoading ? (
          <Cargando texto="Consultando la flota en MobiControl…" />
        ) : (
          <ul className="lista-equipos">
            {visibles.length === 0 && <li className="vacio-lista suave chico">Ningún equipo coincide.</li>}
            {visibles.map((e) => (
              <li key={e.deviceId}>
                <button
                  type="button"
                  className="item-equipo"
                  aria-current={e.deviceId === seleccionado ? "true" : undefined}
                  onClick={() => elegir(e.deviceId)}
                >
                  <PuntoEstado equipo={e} />
                  <span className="item-texto">
                    <span className="item-nombre">{e.nombre}</span>
                    <span className="item-sub">{[e.modelo, grupoCorto(e.grupo)].filter(Boolean).join(" · ") || e.plataforma}</span>
                  </span>
                  <span className="item-lado">
                    <Bateria equipo={e} />
                    <span className="item-tiempo">
                      {e.latitud === null && e.tieneGps && <MapPinOff aria-label="Sin ubicación" />}
                      {haceCuanto(e.ultimoReporte, ahora)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
      </aside>

      {seleccionado && (
        <DetalleEquipo
          deviceId={seleccionado}
          resumen={elegido}
          geocercas={geocercas.data ?? []}
          alCerrar={() => elegir(null)}
        />
      )}

      <div className="mapa-esquina">
        <label className="interruptor vidrio">
          <input type="checkbox" checked={verZonas} onChange={(e) => setVerZonas(e.target.checked)} />
          Geocercas
        </label>
        <ControlesMapa mapa={mapa} fondo={fondo} alCambiarFondo={setFondo} alEncuadrar={encuadrar} />
      </div>
    </div>
  );
}

/** Lo que tapan el panel de la flota (izquierda) y los controles: el encuadre no los usa. */
const MARGEN: Margen = { top: 80, bottom: 60, left: 420, right: 80 };

/** Los equipos más cerca de un lugar buscado, en línea recta. */
function EquiposCerca({ lugar, equipos, alElegir }: { lugar: Lugar; equipos: Equipo[]; alElegir: (id: string) => void }) {
  const cerca = useMemo(
    () =>
      equipos
        .filter((e) => e.latitud !== null && e.longitud !== null)
        .map((e) => ({ e, metros: distancia(lugar.posicion, [e.longitud!, e.latitud!]) }))
        .sort((a, b) => a.metros - b.metros)
        .slice(0, 5),
    [lugar, equipos],
  );

  if (!cerca.length) return null;

  return (
    <div className="equipos-cerca">
      <span className="etiqueta-mini">Equipos más cerca</span>
      <ul>
        {cerca.map(({ e, metros }) => (
          <li key={e.deviceId}>
            <button type="button" className="item-equipo compacto" onClick={() => alElegir(e.deviceId)}>
              <PuntoEstado equipo={e} />
              <span className="item-nombre">{e.nombre}</span>
              <span className="item-tiempo">{metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km`}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------------------------------

function DetalleEquipo({
  deviceId,
  resumen,
  geocercas,
  alCerrar,
}: {
  deviceId: string;
  resumen: Equipo | null;
  geocercas: { geocercaUid: string; nombre: string; color: string }[];
  alCerrar: () => void;
}) {
  const navigate = useNavigate();
  const empresa = useEmpresaClave();
  const queryClient = useQueryClient();
  const detalle = useQuery({ queryKey: ["equipo", empresa, deviceId], queryFn: () => obtenerEquipo(deviceId), staleTime: 20_000 });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const localizar = useMutation({
    mutationFn: () => localizarEquipo(deviceId),
    onSuccess: (r) => {
      setMensaje(r.message);
      // La posición nueva llega en unos segundos: se vuelve a preguntar sin esperar al refresco.
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["equipo", empresa, deviceId] });
        void obtenerFlota(true).then((d) => queryClient.setQueryData(["flota", empresa], d));
      }, 20_000);
    },
    onError: (e: Error) => setMensaje(e.message),
  });

  const e = detalle.data ?? resumen;
  const estado = e ? estadoDe(e) : null;
  const zonas = (e?.geocercas ?? []).map((uid) => geocercas.find((g) => g.geocercaUid === uid)).filter(Boolean);

  return (
    <aside className="detalle-equipo vidrio" aria-label="Detalle del equipo">
      <div className="detalle-cabeza">
        <div className="detalle-titulo">
          {estado && <span className="insignia" data-tono={estado === "en-linea" ? "ok" : estado === "sin-senal" ? "peligro" : undefined}>
            {estado === "en-linea" ? <Wifi aria-hidden /> : estado === "sin-senal" ? <SignalZero aria-hidden /> : <Signal aria-hidden />}
            {NOMBRE_ESTADO[estado]}
          </span>}
          <h2>{e?.nombre ?? deviceId}</h2>
          <p className="suave chico">{[e?.fabricante, e?.modelo].filter(Boolean).join(" ") || "—"}</p>
        </div>
        <button type="button" className="boton fantasma chico icono" aria-label="Cerrar" onClick={alCerrar}>
          <X aria-hidden />
        </button>
      </div>

      {detalle.isError && !resumen && <Aviso tipo="error">{(detalle.error as Error).message}</Aviso>}
      {!e && detalle.isLoading && <Cargando />}

      {e && (
        <>
          <div className="detalle-indicadores">
            <div>
              <span className="etiqueta-mini">Batería</span>
              <Bateria equipo={e} />
              {bateriaBaja(e) && <BatteryWarning className="alerta-icono" aria-label="Batería baja" />}
            </div>
            <div>
              <span className="etiqueta-mini">Último reporte</span>
              <strong>{haceCuanto(e.ultimoReporte)}</strong>
            </div>
            <div>
              <span className="etiqueta-mini">Velocidad</span>
              {/* MobiControl pasa la velocidad tal como la da Android: metros por segundo. */}
              <strong>{e.velocidad !== null && e.velocidad !== undefined ? `${Math.round(e.velocidad * 3.6)} km/h` : "—"}</strong>
            </div>
          </div>

          <section className="detalle-bloque">
            <h3>Ubicación</h3>
            {e.latitud !== null && e.longitud !== null ? (
              <>
                <div className="coordenadas">
                  <span className="mono">{coordenadas(e.latitud, e.longitud)}</span>
                  <button
                    type="button"
                    className="boton fantasma chico icono"
                    aria-label="Copiar coordenadas"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${e.latitud},${e.longitud}`).then(() => {
                        setCopiado(true);
                        window.setTimeout(() => setCopiado(false), 1500);
                      });
                    }}
                  >
                    <Copy aria-hidden />
                  </button>
                  {copiado && <span className="insignia" data-tono="ok">Copiado</span>}
                </div>
                <p className="suave chico">Reportada {haceCuanto(e.fechaUbicacion)} · {formatoFechaHora(e.fechaUbicacion)}</p>
                <a className="chico" href={`https://www.google.com/maps?q=${e.latitud},${e.longitud}`} target="_blank" rel="noreferrer">
                  Abrir en Google Maps <ExternalLink aria-hidden className="icono-enlace" />
                </a>
              </>
            ) : (
              <p className="suave chico">{e.tieneGps ? "El equipo no ha reportado posición." : "Esta plataforma no reporta posición."}</p>
            )}

            {zonas.length > 0 && (
              <div className="zonas">
                {zonas.map((z) => (
                  <span key={z!.geocercaUid} className="insignia" style={{ "--color": z!.color } as React.CSSProperties}>
                    ● {z!.nombre}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="detalle-bloque">
            <h3>Equipo</h3>
            <dl className="datos">
              <Dato nombre="IMEI" valor={e.imei} mono />
              <Dato nombre="Serial" valor={e.serial} mono />
              <Dato nombre="Teléfono" valor={e.telefono} mono />
              <Dato nombre="Plataforma" valor={[e.plataforma, detalle.data?.versionSistema].filter(Boolean).join(" ") || null} />
              <Dato nombre="Agente" valor={detalle.data?.versionAgente} />
              <Dato nombre="Operador" valor={detalle.data?.red} />
              <Dato nombre="Grupo" valor={grupoCorto(e.grupo)} />
              <Dato nombre="Inscrito" valor={detalle.data?.fechaInscripcion ? formatoFechaHora(detalle.data.fechaInscripcion) : null} />
            </dl>
          </section>

          {mensaje && <Aviso tipo={localizar.isError ? "error" : "exito"}>{mensaje}</Aviso>}

          <div className="detalle-acciones">
            <button
              type="button"
              className="boton primario"
              disabled={!e.tieneGps || localizar.isPending}
              onClick={() => localizar.mutate()}
              title={e.enLinea ? undefined : "El equipo no está en línea: responderá cuando se conecte."}
            >
              <Crosshair aria-hidden /> {localizar.isPending ? "Pidiendo…" : "Pedir ubicación"}
            </button>
            <button type="button" className="boton" onClick={() => navigate(`/recorridos?equipo=${encodeURIComponent(deviceId)}`)}>
              <Route aria-hidden /> Ver recorrido
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function Dato({ nombre, valor, mono }: { nombre: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt>{nombre}</dt>
      <dd className={mono && valor ? "mono" : undefined}>{valor || "—"}</dd>
    </div>
  );
}
