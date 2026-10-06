import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Marker, type LngLatBoundsLike } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { CircleDot, Clock, Flag, Gauge, LogIn, LogOut, Pause, Play, Route as IconoRuta, Timer, Zap } from "lucide-react";
import { obtenerRecorrido, type PuntoRecorrido, type Recorrido } from "../api/flota";
import { useEmpresaClave, useFlota, useGeocercas } from "../api/consultas";
import { Aviso, Cargando, PuntoEstado } from "../componentes/Basicos";
import { ControlesMapa } from "../mapa/ControlesMapa";
import { geocercasComoGeoJson, instalarCapasGeocercas } from "../mapa/capasFlota";
import { caja } from "../mapa/geo";
import { FUENTE, type FondoMapa } from "../mapa/estilos";
import { ponerDatos, useMapa, VACIO } from "../mapa/useMapa";
import { duracion, formatoFechaHora, formatoHora } from "../formato";

type Rango = "hoy" | "ayer" | "7dias" | "personalizado";

function rangoDe(tipo: Rango, desdeTexto: string, hastaTexto: string): [Date, Date] {
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  switch (tipo) {
    case "hoy": return [inicioHoy, ahora];
    case "ayer": return [new Date(inicioHoy.getTime() - 86_400_000), inicioHoy];
    case "7dias": return [new Date(ahora.getTime() - 7 * 86_400_000 + 60_000), ahora];
    default: return [new Date(desdeTexto), new Date(hastaTexto)];
  }
}

const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Tramos del recorrido con su velocidad: el mapa los tiñe del azul (lento) al rojo (rápido). */
function tramos(puntos: PuntoRecorrido[]): FeatureCollection {
  const features = [];
  for (let i = 1; i < puntos.length; i++) {
    features.push({
      type: "Feature" as const,
      properties: { v: puntos[i].velocidadKmh ?? 0 },
      geometry: {
        type: "LineString" as const,
        coordinates: [[puntos[i - 1].longitud, puntos[i - 1].latitud], [puntos[i].longitud, puntos[i].latitud]],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Posición en el instante t, interpolada entre los dos puntos que lo rodean. */
function posicionEn(puntos: PuntoRecorrido[], tiempos: number[], t: number): [number, number] | null {
  if (puntos.length === 0) return null;
  if (t <= tiempos[0]) return [puntos[0].longitud, puntos[0].latitud];
  for (let i = 1; i < puntos.length; i++) {
    if (t <= tiempos[i]) {
      const f = (t - tiempos[i - 1]) / Math.max(1, tiempos[i] - tiempos[i - 1]);
      return [
        puntos[i - 1].longitud + (puntos[i].longitud - puntos[i - 1].longitud) * f,
        puntos[i - 1].latitud + (puntos[i].latitud - puntos[i - 1].latitud) * f,
      ];
    }
  }
  const ultimo = puntos[puntos.length - 1];
  return [ultimo.longitud, ultimo.latitud];
}

export function Recorridos() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [fondo, setFondo] = useState<FondoMapa>("calles");
  const { mapa, version } = useMapa(contenedor, fondo);
  const [params, setParams] = useSearchParams();
  const deviceId = params.get("equipo") ?? "";
  const [tipoRango, setTipoRango] = useState<Rango>("hoy");
  const [desdeTexto, setDesdeTexto] = useState(() => aLocal(new Date(Date.now() - 86_400_000)));
  const [hastaTexto, setHastaTexto] = useState(() => aLocal(new Date()));
  const empresa = useEmpresaClave();

  const flota = useFlota();
  const geocercas = useGeocercas();
  const equipos = useMemo(
    () => (flota.data?.equipos ?? []).filter((e) => e.tieneGps).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [flota.data],
  );

  const [desde, hasta] = useMemo(() => rangoDe(tipoRango, desdeTexto, hastaTexto), [tipoRango, desdeTexto, hastaTexto]);
  const rangoValido = !Number.isNaN(desde.getTime()) && !Number.isNaN(hasta.getTime()) && hasta > desde;

  const recorrido = useQuery({
    queryKey: ["recorrido", empresa, deviceId, desde.toISOString(), hasta.toISOString()],
    queryFn: () => obtenerRecorrido(deviceId, desde, hasta),
    enabled: !!deviceId && rangoValido,
    staleTime: 60_000,
  });

  const datos: Recorrido | undefined = recorrido.data;
  const puntos = useMemo(() => datos?.puntos ?? [], [datos]);
  const tiempos = useMemo(() => puntos.map((p) => new Date(p.momento).getTime()), [puntos]);

  // ---- Capas ----
  useEffect(() => {
    if (!mapa || version === 0) return;
    instalarCapasGeocercas(mapa, 0.08);

    if (!mapa.getSource("ruta")) {
      mapa.addSource("ruta", { type: "geojson", data: VACIO });
      mapa.addLayer({
        id: "ruta-sombra",
        type: "line",
        source: "ruta",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0f172a", "line-opacity": 0.25, "line-width": 9, "line-blur": 3 },
      });
      mapa.addLayer({
        id: "ruta",
        type: "line",
        source: "ruta",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 5,
          "line-color": ["interpolate", ["linear"], ["get", "v"], 0, "#38bdf8", 20, "#22c55e", 50, "#eab308", 80, "#f97316", 110, "#dc2626"],
        },
      });

      mapa.addSource("hitos", { type: "geojson", data: VACIO });
      mapa.addLayer({
        id: "paradas",
        type: "circle",
        source: "hitos",
        filter: ["==", ["get", "tipo"], "parada"],
        paint: { "circle-radius": 9, "circle-color": "#7c3aed", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 },
      });
      mapa.addLayer({
        id: "paradas-texto",
        type: "symbol",
        source: "hitos",
        filter: ["==", ["get", "tipo"], "parada"],
        layout: { "text-field": ["get", "etiqueta"], "text-font": FUENTE, "text-size": 9, "text-allow-overlap": true },
        paint: { "text-color": "#fff" },
      });
      mapa.addLayer({
        id: "extremos",
        type: "circle",
        source: "hitos",
        filter: ["in", ["get", "tipo"], ["literal", ["inicio", "fin"]]],
        paint: {
          "circle-radius": 8,
          "circle-color": ["match", ["get", "tipo"], "inicio", "#16a34a", "#0f172a"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 3,
        },
      });
      mapa.addLayer({
        id: "eventos",
        type: "circle",
        source: "hitos",
        filter: ["==", ["get", "tipo"], "evento"],
        paint: { "circle-radius": 5, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
      });
    }
  }, [mapa, version]);

  useEffect(() => {
    if (version === 0) return;
    ponerDatos(mapa, "geocercas", geocercasComoGeoJson((geocercas.data ?? []).filter((g) => g.activa)));
  }, [mapa, version, geocercas.data]);

  useEffect(() => {
    if (version === 0) return;
    ponerDatos(mapa, "ruta", tramos(puntos));

    const hitos: FeatureCollection = { type: "FeatureCollection", features: [] };
    if (puntos.length) {
      const primero = puntos[0];
      const ultimo = puntos[puntos.length - 1];
      hitos.features.push(
        { type: "Feature", properties: { tipo: "inicio" }, geometry: { type: "Point", coordinates: [primero.longitud, primero.latitud] } },
        { type: "Feature", properties: { tipo: "fin" }, geometry: { type: "Point", coordinates: [ultimo.longitud, ultimo.latitud] } },
      );
    }
    datos?.paradas.forEach((p, i) =>
      hitos.features.push({
        type: "Feature",
        properties: { tipo: "parada", etiqueta: String(i + 1) },
        geometry: { type: "Point", coordinates: [p.longitud, p.latitud] },
      }),
    );
    datos?.eventos.forEach((ev) =>
      hitos.features.push({
        type: "Feature",
        properties: { tipo: "evento", color: ev.tipo === "ENTRADA" ? "#16a34a" : "#ea580c" },
        geometry: { type: "Point", coordinates: [ev.longitud, ev.latitud] },
      }),
    );
    ponerDatos(mapa, "hitos", hitos);
  }, [mapa, version, puntos, datos]);

  const encuadrar = useCallback(() => {
    const limites = caja(puntos.map((p) => [p.longitud, p.latitud]));
    if (mapa && limites) mapa.fitBounds(limites as LngLatBoundsLike, { padding: { top: 80, bottom: 140, left: 440, right: 80 }, maxZoom: 16, duration: 900 });
  }, [mapa, puntos]);

  useEffect(() => {
    if (puntos.length) encuadrar();
  }, [puntos, encuadrar]);

  // ---- Reproducción ----
  const [t, setT] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(60);
  const vehiculo = useRef<Marker | null>(null);

  const inicio = tiempos[0] ?? 0;
  const fin = tiempos[tiempos.length - 1] ?? 0;

  useEffect(() => {
    setT(inicio);
    setReproduciendo(false);
  }, [inicio, fin]);

  useEffect(() => {
    if (!reproduciendo) return;
    let anterior = performance.now();
    let id = 0;

    const paso = (ahora: number) => {
      const dt = ahora - anterior;
      anterior = ahora;
      setT((actual) => {
        const siguiente = actual + dt * velocidad;
        if (siguiente >= fin) {
          setReproduciendo(false);
          return fin;
        }
        return siguiente;
      });
      id = requestAnimationFrame(paso);
    };

    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [reproduciendo, velocidad, fin]);

  useEffect(() => {
    const posicion = posicionEn(puntos, tiempos, t);
    if (!mapa || !posicion) {
      vehiculo.current?.remove();
      vehiculo.current = null;
      return;
    }
    if (!vehiculo.current) {
      const elemento = document.createElement("div");
      elemento.className = "vehiculo";
      vehiculo.current = new Marker({ element: elemento }).setLngLat(posicion).addTo(mapa);
    } else {
      vehiculo.current.setLngLat(posicion);
    }
  }, [mapa, puntos, tiempos, t]);

  useEffect(() => () => { vehiculo.current?.remove(); }, []);

  const elegido = equipos.find((e) => e.deviceId === deviceId);
  const est = datos?.estadisticas;

  return (
    <div className="pantalla-mapa">
      <div ref={contenedor} className="mapa" />

      <aside className="panel-flota panel-recorrido vidrio" aria-label="Recorrido">
        <div className="panel-cabeza">
          <div>
            <h1>Recorridos</h1>
            <p className="suave chico">Por dónde anduvo un equipo, según lo que recolectó MobiControl.</p>
          </div>
        </div>

        <label className="etiqueta">
          Equipo
          <select
            className="campo"
            value={deviceId}
            onChange={(e) => setParams(e.target.value ? { equipo: e.target.value } : {}, { replace: true })}
          >
            <option value="">{flota.isLoading ? "Cargando equipos…" : "Elige un equipo"}</option>
            {equipos.map((e) => (
              <option key={e.deviceId} value={e.deviceId}>{e.nombre}{e.modelo ? ` · ${e.modelo}` : ""}</option>
            ))}
          </select>
        </label>

        <div className="segmentado ancho-completo" role="group" aria-label="Rango">
          {([["hoy", "Hoy"], ["ayer", "Ayer"], ["7dias", "7 días"], ["personalizado", "Rango"]] as [Rango, string][]).map(([id, nombre]) => (
            <button key={id} type="button" aria-pressed={tipoRango === id} onClick={() => setTipoRango(id)}>{nombre}</button>
          ))}
        </div>

        {tipoRango === "personalizado" && (
          <div className="rango-personalizado">
            <label className="etiqueta">Desde<input className="campo" type="datetime-local" value={desdeTexto} onChange={(e) => setDesdeTexto(e.target.value)} /></label>
            <label className="etiqueta">Hasta<input className="campo" type="datetime-local" value={hastaTexto} onChange={(e) => setHastaTexto(e.target.value)} /></label>
          </div>
        )}

        {!deviceId ? (
          <div className="vacio-panel">
            <IconoRuta aria-hidden />
            <p>Elige un equipo para ver su recorrido.</p>
          </div>
        ) : !rangoValido ? (
          <Aviso tipo="alerta">El final del rango debe ser posterior al inicio.</Aviso>
        ) : recorrido.isLoading ? (
          <Cargando texto="Trayendo los puntos de MobiControl…" />
        ) : recorrido.isError ? (
          <Aviso tipo="error">{(recorrido.error as Error).message}</Aviso>
        ) : est && est.puntos === 0 ? (
          <Aviso>
            {elegido?.nombre ?? "El equipo"} no tiene puntos en ese rango. MobiControl solo guarda la posición si la regla de
            recolección de datos de la consola incluye la ubicación.
          </Aviso>
        ) : est ? (
          <div className="recorrido-cuerpo">
            <div className="estadisticas">
              <Estadistica Icono={IconoRuta} valor={`${est.distanciaKm.toLocaleString("es-CO")} km`} nombre="Distancia" />
              <Estadistica Icono={Clock} valor={duracion(est.duracionMinutos)} nombre="Duración" />
              <Estadistica Icono={Timer} valor={duracion(est.minutosEnMovimiento)} nombre="En movimiento" />
              <Estadistica Icono={Gauge} valor={`${est.velocidadPromedioKmh} km/h`} nombre="Vel. promedio" />
              <Estadistica Icono={Zap} valor={`${est.velocidadMaximaKmh} km/h`} nombre="Vel. máxima" />
              <Estadistica Icono={CircleDot} valor={String(est.paradas)} nombre="Paradas" />
            </div>

            <div className="leyenda-velocidad" aria-hidden>
              <span>0</span><div className="degradado" /><span>110+ km/h</span>
            </div>

            <ol className="linea-tiempo">
              <Hito Icono={Flag} tono="ok" titulo="Inicio" momento={puntos[0]?.momento} />
              {[
                ...datos!.paradas.map((p, i) => ({ orden: p.inicio, nodo: (
                  <Hito key={`p${i}`} Icono={CircleDot} tono="parada" titulo={`Parada ${i + 1} · ${duracion(p.minutos)}`}
                    momento={p.inicio} detalle={`${formatoHora(p.inicio)} – ${formatoHora(p.fin)}`} />
                ) })),
                ...datos!.eventos.map((ev, i) => ({ orden: ev.momento, nodo: (
                  <Hito key={`e${i}`} Icono={ev.tipo === "ENTRADA" ? LogIn : LogOut} tono={ev.tipo === "ENTRADA" ? "ok" : "aviso"}
                    titulo={`${ev.tipo === "ENTRADA" ? "Entró a" : "Salió de"} ${ev.nombre}`} momento={ev.momento} />
                ) })),
              ]
                .sort((a, b) => a.orden.localeCompare(b.orden))
                .map((x) => x.nodo)}
              <Hito Icono={Flag} tono="fin" titulo="Último punto" momento={puntos[puntos.length - 1]?.momento} />
            </ol>
          </div>
        ) : null}
      </aside>

      {puntos.length > 1 && (
        <div className="reproductor vidrio" role="group" aria-label="Reproducción del recorrido">
          <button
            type="button"
            className="boton primario icono"
            aria-label={reproduciendo ? "Pausar" : "Reproducir"}
            onClick={() => {
              if (!reproduciendo && t >= fin) setT(inicio);
              setReproduciendo((r) => !r);
            }}
          >
            {reproduciendo ? <Pause aria-hidden /> : <Play aria-hidden />}
          </button>
          <div className="reproductor-pista">
            <input
              type="range"
              min={inicio}
              max={fin}
              step={1000}
              value={t}
              aria-label="Momento del recorrido"
              aria-valuetext={formatoFechaHora(new Date(t))}
              onChange={(e) => { setReproduciendo(false); setT(Number(e.target.value)); }}
              style={{ "--avance": `${((t - inicio) / Math.max(1, fin - inicio)) * 100}%` } as React.CSSProperties}
            />
            <div className="reproductor-tiempos suave chico">
              <span>{formatoHora(new Date(inicio))}</span>
              <strong className="mono">{formatoFechaHora(new Date(t))}</strong>
              <span>{formatoHora(new Date(fin))}</span>
            </div>
          </div>
          <div className="segmentado" role="group" aria-label="Velocidad de reproducción">
            {[60, 300, 1200].map((v) => (
              <button key={v} type="button" aria-pressed={velocidad === v} onClick={() => setVelocidad(v)}>{v / 60}×</button>
            ))}
          </div>
        </div>
      )}

      {/* Arriba: abajo va el reproductor. */}
      <div className="mapa-esquina arriba">
        {elegido && (
          <span className="chip-equipo vidrio"><PuntoEstado equipo={elegido} /> {elegido.nombre}</span>
        )}
        <ControlesMapa mapa={mapa} fondo={fondo} alCambiarFondo={setFondo} alEncuadrar={puntos.length ? encuadrar : undefined} />
      </div>
    </div>
  );
}

function Estadistica({ Icono, valor, nombre }: { Icono: typeof Clock; valor: string; nombre: string }) {
  return (
    <div className="estadistica">
      <Icono aria-hidden />
      <strong>{valor}</strong>
      <span>{nombre}</span>
    </div>
  );
}

function Hito({ Icono, tono, titulo, momento, detalle }: {
  Icono: typeof Clock; tono: string; titulo: string; momento?: string; detalle?: string;
}) {
  return (
    <li className="hito" data-tono={tono}>
      <span className="hito-icono"><Icono aria-hidden /></span>
      <div>
        <strong>{titulo}</strong>
        <span className="suave chico">{detalle ?? (momento ? formatoFechaHora(momento) : "")}</span>
      </div>
    </li>
  );
}
