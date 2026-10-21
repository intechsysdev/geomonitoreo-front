import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, MapPin, Search } from "lucide-react";
import { useConPausa, useConfiguracion, useFlota, useGeocercas } from "../api/consultas";
import { exportarEquipos, type Equipo, type EstadoFiltro, type FiltroFlota, type OrdenFlota } from "../api/flota";
import { Aviso, Bateria, Cargando, PuntoEstado } from "../componentes/Basicos";
import { estadoDe, formatoFechaHora, grupoCorto, haceCuanto, NOMBRE_ESTADO } from "../formato";

const ESTADOS: { id: EstadoFiltro; nombre: string }[] = [
  { id: "en-linea", nombre: NOMBRE_ESTADO["en-linea"] },
  { id: "inactivo", nombre: NOMBRE_ESTADO.inactivo },
  { id: "sin-senal", nombre: NOMBRE_ESTADO["sin-senal"] },
  { id: "bateria", nombre: "Batería baja" },
];

/** CSV con separador ";" y BOM: así lo abre Excel en español sin pedir nada. */
function descargarCsv(equipos: Equipo[], zonas: Map<string, string>) {
  const fila = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const encabezado = ["Nombre", "Estado", "Fabricante", "Modelo", "Plataforma", "Batería", "Último reporte", "Grupo", "IMEI", "Serial", "Teléfono", "Latitud", "Longitud", "Geocercas"];
  const filas = equipos.map((e) => [
    e.nombre, NOMBRE_ESTADO[estadoDe(e)], e.fabricante, e.modelo, e.plataforma, e.bateria, formatoFechaHora(e.ultimoReporte),
    grupoCorto(e.grupo), e.imei, e.serial, e.telefono, e.latitud, e.longitud, e.geocercas.map((g) => zonas.get(g)).filter(Boolean).join(", "),
  ]);

  const csv = "﻿" + [encabezado, ...filas].map((f) => f.map(fila).join(";")).join("\r\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  enlace.download = `flota-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

type Orden = { columna: OrdenFlota; asc: boolean };

/** Las columnas se ordenan en MobiControl, así que el orden vale para toda la flota y no solo lo cargado. */
function Encabezado({ columna, orden, alOrdenar, children }: {
  columna: OrdenFlota; orden: Orden; alOrdenar: (o: Orden) => void; children: string;
}) {
  const activa = orden.columna === columna;
  return (
    <th aria-sort={activa ? (orden.asc ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => alOrdenar({ columna, asc: activa ? !orden.asc : true })}>
        {children}
        {activa && (orden.asc ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />)}
      </button>
    </th>
  );
}

export function Dispositivos() {
  const navigate = useNavigate();
  const configuracion = useConfiguracion();
  const geocercas = useGeocercas();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro | "todos">("todos");
  const [orden, setOrden] = useState<Orden>({ columna: "estado", asc: true });

  const buscar = useConPausa(busqueda.trim());
  const filtro: FiltroFlota = { buscar, estado: estado === "todos" ? null : estado, orden: orden.columna, desc: !orden.asc };
  const flota = useFlota({ activa: configuracion.data?.mobiControlConfigurado ?? false, filtro });

  const equipos = useMemo(() => flota.data?.equipos ?? [], [flota.data]);
  const zonas = useMemo(() => new Map((geocercas.data ?? []).map((g) => [g.geocercaUid, g.nombre])), [geocercas.data]);
  const total = flota.total ?? 0;
  const restantes = Math.max(0, total - equipos.length);

  // Se exporta todo lo que cumple el filtro, no solo lo cargado: lo arma el API de a 500.
  const exportar = useMutation({
    mutationFn: () => exportarEquipos(filtro),
    onSuccess: (todos) => descargarCsv(todos, zonas),
  });

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <h1>Dispositivos</h1>
          <p className="suave">
            {flota.data
              ? `${buscar || estado !== "todos" ? `${total.toLocaleString("es-CO")} coinciden` : `${total.toLocaleString("es-CO")} equipos`}` +
                `${restantes > 0 ? ` · se muestran ${equipos.length}` : ""} · actualizado ${haceCuanto(flota.data.consultado)}`
              : "Inventario de la consola de MobiControl"}
          </p>
        </div>
        <button type="button" className="boton" disabled={!total || exportar.isPending} onClick={() => exportar.mutate()}>
          <Download aria-hidden /> {exportar.isPending ? "Exportando…" : `Exportar CSV${total > equipos.length ? ` (${total.toLocaleString("es-CO")})` : ""}`}
        </button>
      </header>

      {exportar.isError && <Aviso tipo="error">No se pudo exportar: {(exportar.error as Error).message}</Aviso>}

      <div className="filtros">
        <label className="buscador">
          <span className="visualmente-oculto">Buscar</span>
          <Search aria-hidden />
          <input className="campo" type="search" placeholder="Nombre, modelo o serial…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <select className="campo" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((k) => <option key={k.id} value={k.id}>{k.nombre}</option>)}
        </select>
      </div>

      {configuracion.data && !configuracion.data.mobiControlConfigurado ? (
        <Aviso tipo="alerta">Esta empresa todavía no tiene su consola de MobiControl configurada en Intechsys One.</Aviso>
      ) : flota.isLoading || configuracion.isLoading ? (
        <Cargando texto="Consultando la flota en MobiControl…" />
      ) : flota.isError ? (
        <Aviso tipo="error">{(flota.error as Error).message}</Aviso>
      ) : (
        <>
          {flota.aviso && <Aviso tipo="alerta">{flota.aviso}</Aviso>}
          <div className="tarjeta tabla-contenedor" aria-busy={flota.buscando || undefined} data-buscando={flota.buscando || undefined}>
            <table className="tabla">
              <thead>
                <tr>
                  <Encabezado columna="estado" orden={orden} alOrdenar={setOrden}>Estado</Encabezado>
                  <Encabezado columna="nombre" orden={orden} alOrdenar={setOrden}>Equipo</Encabezado>
                  <Encabezado columna="modelo" orden={orden} alOrdenar={setOrden}>Modelo</Encabezado>
                  <Encabezado columna="bateria" orden={orden} alOrdenar={setOrden}>Batería</Encabezado>
                  <Encabezado columna="ultimoReporte" orden={orden} alOrdenar={setOrden}>Último reporte</Encabezado>
                  <th>Grupo</th>
                  <th>IMEI / Teléfono</th>
                  <th>Zona</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => (
                  <tr key={e.deviceId} data-clic onClick={() => navigate(`/monitor?equipo=${encodeURIComponent(e.deviceId)}`)}>
                    <td><span className="celda-estado"><PuntoEstado equipo={e} /> {NOMBRE_ESTADO[estadoDe(e)]}</span></td>
                    <td>
                      <strong>{e.nombre}</strong>
                      <div className="suave chico">{e.plataforma}</div>
                    </td>
                    <td>{[e.fabricante, e.modelo].filter(Boolean).join(" ") || "—"}</td>
                    <td><Bateria equipo={e} /></td>
                    <td title={formatoFechaHora(e.ultimoReporte)}>{haceCuanto(e.ultimoReporte)}</td>
                    <td>{grupoCorto(e.grupo) ?? "—"}</td>
                    <td>
                      <span className="mono">{e.imei ?? "—"}</span>
                      {e.telefono && <div className="suave chico mono">{e.telefono}</div>}
                    </td>
                    <td>
                      {e.geocercas.length ? (
                        e.geocercas.map((g) => <span key={g} className="insignia" data-tono="marca">{zonas.get(g) ?? "Zona"}</span>)
                      ) : e.latitud !== null ? (
                        <span className="suave chico sin-salto"><MapPin size={13} aria-hidden style={{ display: "inline" }} /> Fuera de zonas</span>
                      ) : (
                        <span className="suave chico">{e.tieneGps && flota.ubicando ? "Ubicando…" : "Sin ubicación"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {equipos.length === 0 && (
              <p className="vacio-lista suave">Ningún equipo coincide. Se busca por nombre, modelo, fabricante o serial.</p>
            )}
            {flota.hayMas && (
              <div className="cargar-mas">
                <button type="button" className="boton fantasma" disabled={flota.cargandoMas} onClick={flota.cargarMas}>
                  {flota.cargandoMas
                    ? "Cargando…"
                    : `Cargar ${Math.min(100, restantes).toLocaleString("es-CO")} más (quedan ${restantes.toLocaleString("es-CO")})`}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
