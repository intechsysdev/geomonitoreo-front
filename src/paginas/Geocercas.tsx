import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LngLatBoundsLike, MapLayerMouseEvent, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { CloudOff, Circle, Hexagon, Pencil, Plus, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import {
  actualizarGeocerca, crearGeocerca, eliminarGeocerca, type Geocerca, type GeocercaCambio, type TipoGeocerca,
} from "../api/geocercas";
import { useEmpresaClave, useFlota, useListaGeocercas } from "../api/consultas";
import { Aviso, Cargando, Dialogo } from "../componentes/Basicos";
import { ControlesMapa } from "../mapa/ControlesMapa";
import { flotaComoGeoJson, geocercasComoGeoJson, instalarCapasFlota, instalarCapasGeocercas } from "../mapa/capasFlota";
import { anilloCirculo, caja, distancia, poligonoDe } from "../mapa/geo";
import type { FondoMapa } from "../mapa/estilos";
import { ponerDatos, useMapa, VACIO } from "../mapa/useMapa";
import { useTema } from "../tema/Tema";

const COLORES = ["#0ea5e9", "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

/** Lo que se está dibujando: el tipo y los puntos puestos hasta ahora. */
interface Borrador {
  tipo: TipoGeocerca;
  puntos: [number, number][];
  radio: number | null;
  /** Geocerca que se está redibujando, o null si es nueva. */
  uid: string | null;
}

interface Formulario {
  uid: string | null;
  nombre: string;
  descripcion: string;
  color: string;
  activa: boolean;
  tipo: TipoGeocerca;
  centro: [number, number] | null;
  radio: number;
  vertices: [number, number][];
}

const formularioDe = (g: Geocerca): Formulario => ({
  uid: g.geocercaUid,
  nombre: g.nombre,
  descripcion: g.descripcion ?? "",
  color: g.color,
  activa: g.activa,
  tipo: g.tipo,
  centro: [g.longitud, g.latitud],
  radio: g.radioMetros ?? 300,
  vertices: g.vertices,
});

export function Geocercas() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [fondo, setFondo] = useState<FondoMapa>("auto");
  const { oscuro } = useTema();
  const { mapa, version } = useMapa(contenedor, fondo);
  const empresa = useEmpresaClave();
  const queryClient = useQueryClient();

  const geocercas = useListaGeocercas();
  const flota = useFlota();
  const lista = useMemo(() => geocercas.data?.geocercas ?? [], [geocercas.data]);

  const [elegida, setElegida] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aBorrar, setABorrar] = useState<Geocerca | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dentroPorZona = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const e of flota.data?.equipos ?? []) for (const uid of e.geocercas) conteo.set(uid, (conteo.get(uid) ?? 0) + 1);
    return conteo;
  }, [flota.data]);

  // ---- Capas ----
  useEffect(() => {
    if (!mapa || version === 0) return;
    instalarCapasGeocercas(mapa, 0.16);
    instalarCapasFlota(mapa, oscuro);

    if (!mapa.getSource("borrador")) {
      mapa.addSource("borrador", { type: "geojson", data: VACIO });
      mapa.addLayer({ id: "borrador-relleno", type: "fill", source: "borrador", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.18 } });
      mapa.addLayer({ id: "borrador-borde", type: "line", source: "borrador", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#0ea5e9", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
      mapa.addLayer({ id: "borrador-vertices", type: "circle", source: "borrador", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#0ea5e9", "circle-stroke-width": 2.5 } });
    }
  }, [mapa, version, oscuro]);

  useEffect(() => {
    if (version === 0) return;
    ponerDatos(mapa, "geocercas", geocercasComoGeoJson(lista));
  }, [mapa, version, lista]);

  useEffect(() => {
    if (version === 0) return;
    ponerDatos(mapa, "flota", flotaComoGeoJson(flota.data?.equipos ?? []));
  }, [mapa, version, flota.data]);

  // Resalta la elegida.
  const anterior = useRef<string | null>(null);
  useEffect(() => {
    if (!mapa || version === 0 || !mapa.getSource("geocercas")) return;
    if (anterior.current) mapa.setFeatureState({ source: "geocercas", id: anterior.current }, { resaltada: false });
    if (elegida) mapa.setFeatureState({ source: "geocercas", id: elegida }, { resaltada: true });
    anterior.current = elegida;
  }, [mapa, version, elegida, lista]);

  // Dibujo del borrador.
  useEffect(() => {
    if (version === 0) return;
    const datos: FeatureCollection = { type: "FeatureCollection", features: [] };

    if (borrador?.tipo === "CIRCULO" && borrador.puntos.length === 1) {
      const centro = borrador.puntos[0];
      const radio = borrador.radio ?? (cursor ? distancia(centro, cursor) : 0);
      if (radio > 0) datos.features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anilloCirculo(centro, radio)] } });
      datos.features.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: centro } });
    }

    if (borrador?.tipo === "POLIGONO" && borrador.puntos.length) {
      const anillo = cursor ? [...borrador.puntos, cursor] : borrador.puntos;
      if (anillo.length >= 3) datos.features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...anillo, anillo[0]]] } });
      else datos.features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: anillo } });
      for (const p of borrador.puntos) datos.features.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } });
    }

    ponerDatos(mapa, "borrador", datos);
  }, [mapa, version, borrador, cursor]);

  // ---- Interacción de dibujo ----
  const terminarPoligono = useCallback(() => {
    if (!borrador || borrador.tipo !== "POLIGONO" || borrador.puntos.length < 3) return;
    abrirFormularioDesdeBorrador(borrador.puntos, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador]);

  function abrirFormularioDesdeBorrador(crudos: [number, number][], radio: number | null) {
    if (!borrador) return;

    // El doble clic que cierra el polígono llega antes como dos clics: dos vértices encima del último.
    const puntos = crudos.filter((p, i) => i === 0 || distancia(p, crudos[i - 1]) > 2);
    if (borrador.tipo === "POLIGONO" && puntos.length < 3) return;

    const base = borrador.uid ? lista.find((g) => g.geocercaUid === borrador.uid) : undefined;

    setFormulario({
      uid: borrador.uid,
      nombre: base?.nombre ?? "",
      descripcion: base?.descripcion ?? "",
      color: base?.color ?? COLORES[lista.length % COLORES.length],
      activa: base?.activa ?? true,
      tipo: borrador.tipo,
      centro: borrador.tipo === "CIRCULO" ? puntos[0] : null,
      radio: Math.round(radio ?? 300),
      vertices: borrador.tipo === "POLIGONO" ? puntos : [],
    });
    setBorrador(null);
    setCursor(null);
  }

  useEffect(() => {
    if (!mapa || !borrador) return;

    mapa.getCanvas().style.cursor = "crosshair";
    mapa.doubleClickZoom.disable();

    const clic = (e: MapMouseEvent) => {
      const punto: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (borrador.tipo === "CIRCULO") {
        if (borrador.puntos.length === 0) setBorrador({ ...borrador, puntos: [punto] });
        else abrirFormularioDesdeBorrador(borrador.puntos, Math.max(10, distancia(borrador.puntos[0], punto)));
      } else {
        setBorrador({ ...borrador, puntos: [...borrador.puntos, punto] });
      }
    };

    const mover = (e: MapMouseEvent) => setCursor([e.lngLat.lng, e.lngLat.lat]);
    const doble = (e: MapMouseEvent) => {
      e.preventDefault();
      terminarPoligono();
    };

    mapa.on("click", clic);
    mapa.on("mousemove", mover);
    mapa.on("dblclick", doble);

    return () => {
      mapa.off("click", clic);
      mapa.off("mousemove", mover);
      mapa.off("dblclick", doble);
      mapa.getCanvas().style.cursor = "";
      mapa.doubleClickZoom.enable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, borrador, terminarPoligono]);

  useEffect(() => {
    if (!borrador) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setBorrador(null); setCursor(null); }
      if (e.key === "Enter") terminarPoligono();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [borrador, terminarPoligono]);

  // Clic en una zona (sin estar dibujando): elegirla.
  useEffect(() => {
    if (!mapa || version === 0 || borrador) return;
    const clic = (e: MapLayerMouseEvent) => {
      const uid = e.features?.[0]?.properties.uid as string | undefined;
      if (uid) setElegida(uid);
    };
    mapa.on("click", "geocercas-relleno", clic);
    return () => { mapa.off("click", "geocercas-relleno", clic); };
  }, [mapa, version, borrador]);

  const enfocar = useCallback((g: Geocerca) => {
    const limites = caja(poligonoDe(g));
    if (mapa && limites) mapa.fitBounds(limites as LngLatBoundsLike, { padding: { top: 80, bottom: 80, left: 440, right: 80 }, maxZoom: 17, duration: 800 });
  }, [mapa]);

  // ---- Guardado ----
  const guardar = useMutation({
    mutationFn: (f: Formulario) => {
      const cambio: GeocercaCambio = {
        nombre: f.nombre.trim(),
        descripcion: f.descripcion.trim() || null,
        tipo: f.tipo,
        color: f.color,
        activa: f.activa,
        latitud: f.centro?.[1] ?? null,
        longitud: f.centro?.[0] ?? null,
        radioMetros: f.tipo === "CIRCULO" ? f.radio : null,
        vertices: f.tipo === "POLIGONO" ? f.vertices : null,
      };
      return f.uid ? actualizarGeocerca(f.uid, cambio) : crearGeocerca(cambio);
    },
    onSuccess: (g) => {
      setFormulario(null);
      setError(null);
      setElegida(g.geocercaUid);
      void queryClient.invalidateQueries({ queryKey: ["geocercas", empresa] });
      void queryClient.invalidateQueries({ queryKey: ["flota", empresa] });
    },
    onError: (e: Error) => setError(e.message),
  });

  /** Una geocerca que ya no está en MobiControl se vuelve a crear allá con su forma guardada. */
  const recrear = useMutation({
    mutationFn: (g: Geocerca) => actualizarGeocerca(g.geocercaUid, {
      nombre: g.nombre, descripcion: g.descripcion, tipo: g.tipo, color: g.color, activa: g.activa,
      latitud: g.latitud, longitud: g.longitud, radioMetros: g.radioMetros, vertices: g.tipo === "POLIGONO" ? g.vertices : null,
    }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["geocercas", empresa] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const borrar = useMutation({
    mutationFn: (g: Geocerca) => eliminarGeocerca(g.geocercaUid),
    onSuccess: () => {
      setABorrar(null);
      setElegida(null);
      void queryClient.invalidateQueries({ queryKey: ["geocercas", empresa] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const empezar = (tipo: TipoGeocerca, uid: string | null = null) => {
    setElegida(null);
    setError(null);
    setBorrador({ tipo, puntos: [], radio: null, uid });
  };

  return (
    <div className="pantalla-mapa">
      <div ref={contenedor} className="mapa" />

      <aside className="panel-flota vidrio" aria-label="Geocercas">
        <div className="panel-cabeza">
          <div>
            <h1>Geocercas</h1>
            <p className="suave chico">
              Las de la consola de MobiControl, también las creadas allá. Lo que se crea, edita o borra aquí cambia en la consola.
            </p>
          </div>
          <button
            type="button"
            className="boton fantasma chico icono"
            aria-label="Volver a leer de MobiControl"
            title="Volver a leer de MobiControl"
            onClick={() => void geocercas.refetch()}
          >
            <RefreshCw aria-hidden className={geocercas.isFetching ? "girando" : undefined} />
          </button>
        </div>

        <div className="botones-dibujo">
          <button type="button" className="boton primario" onClick={() => empezar("POLIGONO")} disabled={!!borrador}>
            <Hexagon aria-hidden /> Polígono
          </button>
          <button type="button" className="boton" onClick={() => empezar("CIRCULO")} disabled={!!borrador}>
            <Circle aria-hidden /> Círculo
          </button>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {geocercas.data && !geocercas.data.sincronizadas && (
          <Aviso tipo="alerta">No se pudo leer MobiControl ({geocercas.data.aviso}). Se muestran las formas guardadas.</Aviso>
        )}

        {geocercas.isLoading ? (
          <Cargando />
        ) : geocercas.isError ? (
          <Aviso tipo="error">{(geocercas.error as Error).message}</Aviso>
        ) : lista.length === 0 ? (
          <div className="vacio-panel">
            <Hexagon aria-hidden />
            <p>La consola de MobiControl no tiene geocercas. Dibuja la primera sobre el mapa.</p>
          </div>
        ) : (
          <ul className="lista-zonas">
            {lista.map((g) => (
              <li key={g.geocercaUid}>
                <div className="zona" aria-current={elegida === g.geocercaUid ? "true" : undefined}>
                  <button type="button" className="zona-principal" onClick={() => { setElegida(g.geocercaUid); enfocar(g); }}>
                    <span className="zona-color" style={{ background: g.color }} />
                    <span className="item-texto">
                      <span className="item-nombre">{g.nombre}</span>
                      <span className="item-sub">
                        {g.tipo === "CIRCULO" ? `Círculo · ${Math.round(g.radioMetros ?? 0)} m` : `Polígono · ${g.vertices.length} vértices`}
                        {!g.activa && " · inactiva"}
                      </span>
                    </span>
                    {!g.enMobiControl && (
                      <span className="insignia" data-tono="peligro" title="La borraron en la consola de MobiControl">
                        <CloudOff aria-hidden /> No está
                      </span>
                    )}
                    <span className="insignia" data-tono={dentroPorZona.get(g.geocercaUid) ? "marca" : undefined} title="Equipos dentro ahora">
                      {dentroPorZona.get(g.geocercaUid) ?? 0} dentro
                    </span>
                  </button>
                  {elegida === g.geocercaUid && !g.enMobiControl && (
                    <div className="zona-acciones">
                      <span className="suave chico">Ya no está en MobiControl.</span>
                      <button type="button" className="boton chico primario" disabled={recrear.isPending} onClick={() => recrear.mutate(g)}>
                        {recrear.isPending ? "Creando…" : "Crear en MobiControl"}
                      </button>
                    </div>
                  )}
                  {elegida === g.geocercaUid && (
                    <div className="zona-acciones">
                      <button type="button" className="boton chico" onClick={() => setFormulario(formularioDe(g))}><Pencil aria-hidden /> Editar</button>
                      <button type="button" className="boton chico" onClick={() => empezar(g.tipo, g.geocercaUid)}><Hexagon aria-hidden /> Redibujar</button>
                      <button type="button" className="boton chico peligro" onClick={() => setABorrar(g)}><Trash2 aria-hidden /> Eliminar</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {borrador && (
        <div className="barra-dibujo vidrio" role="status">
          <strong>{borrador.tipo === "CIRCULO" ? "Círculo" : "Polígono"}</strong>
          {borrador.uid && (
            <span className="insignia" data-tono="aviso" title="MobiControl no edita formas: la borra y la crea de nuevo">
              Se recrea en MobiControl: revise las reglas que la usen
            </span>
          )}
          <span className="suave chico">
            {borrador.tipo === "CIRCULO"
              ? borrador.puntos.length === 0 ? "Haz clic en el centro." : "Haz clic para fijar el radio."
              : borrador.puntos.length < 3
                ? `Haz clic para poner vértices (${borrador.puntos.length}/3 mínimo).`
                : "Doble clic o Enter para terminar."}
          </span>
          {borrador.tipo === "POLIGONO" && (
            <>
              <button type="button" className="boton chico" disabled={!borrador.puntos.length}
                onClick={() => setBorrador({ ...borrador, puntos: borrador.puntos.slice(0, -1) })}>
                <Undo2 aria-hidden /> Deshacer
              </button>
              <button type="button" className="boton chico primario" disabled={borrador.puntos.length < 3} onClick={terminarPoligono}>
                <Plus aria-hidden /> Terminar
              </button>
            </>
          )}
          <button type="button" className="boton chico fantasma" onClick={() => { setBorrador(null); setCursor(null); }}>
            <X aria-hidden /> Cancelar
          </button>
        </div>
      )}

      <Dialogo
        abierto={!!formulario}
        alCerrar={() => setFormulario(null)}
        titulo={formulario?.uid ? "Editar geocerca" : "Nueva geocerca"}
        acciones={
          <>
            <button type="button" className="boton" onClick={() => setFormulario(null)}>Cancelar</button>
            <button type="submit" form="form-geocerca" className="boton primario" disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        {formulario && (
          <form
            id="form-geocerca"
            className="formulario"
            onSubmit={(e) => { e.preventDefault(); guardar.mutate(formulario); }}
          >
            {error && <Aviso tipo="error">{error}</Aviso>}
            <label className="etiqueta">
              Nombre
              <input className="campo" required maxLength={100} autoFocus value={formulario.nombre}
                onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} placeholder="Sede principal, Distrito Norte…" />
            </label>
            <label className="etiqueta">
              Descripción
              <textarea className="campo" maxLength={500} value={formulario.descripcion}
                onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
            </label>
            {formulario.tipo === "CIRCULO" && (
              <label className="etiqueta">
                Radio (metros)
                <input className="campo" type="number" min={10} max={100000} step={10} required value={formulario.radio}
                  onChange={(e) => setFormulario({ ...formulario, radio: Number(e.target.value) })} />
              </label>
            )}
            <fieldset className="colores">
              <legend className="etiqueta">Color</legend>
              {COLORES.map((c) => (
                <label key={c} className="muestra" style={{ "--muestra": c } as React.CSSProperties}>
                  <input type="radio" name="color" value={c} checked={formulario.color === c}
                    onChange={() => setFormulario({ ...formulario, color: c })} />
                  <span className="visualmente-oculto">{c}</span>
                </label>
              ))}
            </fieldset>
            <label className="interruptor-linea">
              <input type="checkbox" checked={formulario.activa} onChange={(e) => setFormulario({ ...formulario, activa: e.target.checked })} />
              Activa: se usa para saber qué equipos están dentro
            </label>
          </form>
        )}
      </Dialogo>

      <Dialogo
        abierto={!!aBorrar}
        alCerrar={() => setABorrar(null)}
        titulo="¿Eliminar la geocerca?"
        acciones={
          <>
            <button type="button" className="boton" onClick={() => setABorrar(null)}>Cancelar</button>
            <button type="button" className="boton peligro-lleno" disabled={borrar.isPending} onClick={() => aBorrar && borrar.mutate(aBorrar)}>
              Eliminar
            </button>
          </>
        }
      >
        <p>
          Se elimina <strong>{aBorrar?.nombre}</strong> de Geomonitoreo{aBorrar?.enMobiControl ? " y de MobiControl" : ""}.
          {aBorrar?.enMobiControl && " Las reglas de la consola que la usen dejarán de tenerla."} Si solo quieres dejar de
          usarla aquí, desactívala desde Editar.
        </p>
      </Dialogo>

      <div className="mapa-esquina">
        <ControlesMapa mapa={mapa} fondo={fondo} alCambiarFondo={setFondo} />
      </div>
    </div>
  );
}
