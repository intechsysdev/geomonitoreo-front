import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Download, MapPin, Search } from "lucide-react";
import { useConfiguracion, useFlota, useGeocercas } from "../api/consultas";
import type { Equipo } from "../api/flota";
import { Aviso, Bateria, Cargando, PuntoEstado } from "../componentes/Basicos";
import { estadoDe, formatoFechaHora, grupoCorto, haceCuanto, NOMBRE_ESTADO, type EstadoEquipo } from "../formato";

type Columna = "nombre" | "estado" | "modelo" | "bateria" | "ultimoReporte" | "grupo";

const ORDEN_ESTADO: Record<EstadoEquipo, number> = { "en-linea": 0, inactivo: 1, "sin-senal": 2 };

function valor(e: Equipo, c: Columna): string | number {
  switch (c) {
    case "estado": return ORDEN_ESTADO[estadoDe(e)];
    case "modelo": return `${e.fabricante ?? ""} ${e.modelo ?? ""}`.trim().toLowerCase();
    case "bateria": return e.bateria ?? -1;
    case "ultimoReporte": return e.ultimoReporte ? new Date(e.ultimoReporte).getTime() : 0;
    case "grupo": return (grupoCorto(e.grupo) ?? "").toLowerCase();
    default: return e.nombre.toLowerCase();
  }
}

/** CSV con separador ";" y BOM: así lo abre Excel en español sin pedir nada. */
function exportar(equipos: Equipo[], zonas: Map<string, string>) {
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

type Orden = { columna: Columna; asc: boolean };

function Encabezado({ columna, orden, alOrdenar, children }: {
  columna: Columna; orden: Orden; alOrdenar: (o: Orden) => void; children: string;
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
  const flota = useFlota(configuracion.data?.mobiControlConfigurado ?? false);
  const geocercas = useGeocercas();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<"todos" | EstadoEquipo>("todos");
  const [plataforma, setPlataforma] = useState("todas");
  const [orden, setOrden] = useState<Orden>({ columna: "estado", asc: true });

  const equipos = useMemo(() => flota.data?.equipos ?? [], [flota.data]);
  const plataformas = useMemo(() => [...new Set(equipos.map((e) => e.plataforma).filter(Boolean))] as string[], [equipos]);
  const zonas = useMemo(() => new Map((geocercas.data ?? []).map((g) => [g.geocercaUid, g.nombre])), [geocercas.data]);

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return equipos
      .filter((e) => estado === "todos" || estadoDe(e) === estado)
      .filter((e) => plataforma === "todas" || e.plataforma === plataforma)
      .filter((e) => !texto || [e.nombre, e.modelo, e.fabricante, e.imei, e.serial, e.telefono, e.grupo].some((v) => v?.toLowerCase().includes(texto)))
      .sort((a, b) => {
        const va = valor(a, orden.columna);
        const vb = valor(b, orden.columna);
        const c = va < vb ? -1 : va > vb ? 1 : a.nombre.localeCompare(b.nombre);
        return orden.asc ? c : -c;
      });
  }, [equipos, busqueda, estado, plataforma, orden]);

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <h1>Dispositivos</h1>
          <p className="suave">
            {flota.data ? `${filas.length} de ${equipos.length} equipos · actualizado ${haceCuanto(flota.data.consultado)}` : "Inventario de la consola de MobiControl"}
          </p>
        </div>
        <button type="button" className="boton" disabled={!filas.length} onClick={() => exportar(filas, zonas)}>
          <Download aria-hidden /> Exportar CSV
        </button>
      </header>

      <div className="filtros">
        <label className="buscador">
          <span className="visualmente-oculto">Buscar</span>
          <Search aria-hidden />
          <input className="campo" type="search" placeholder="Nombre, IMEI, serial, teléfono…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <select className="campo" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
          <option value="todos">Todos los estados</option>
          {(Object.keys(NOMBRE_ESTADO) as EstadoEquipo[]).map((k) => <option key={k} value={k}>{NOMBRE_ESTADO[k]}</option>)}
        </select>
        <select className="campo" aria-label="Plataforma" value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
          <option value="todas">Todas las plataformas</option>
          {plataformas.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {configuracion.data && !configuracion.data.mobiControlConfigurado ? (
        <Aviso tipo="alerta">Esta empresa todavía no tiene su consola de MobiControl configurada en Intechsys One.</Aviso>
      ) : flota.isLoading || configuracion.isLoading ? (
        <Cargando texto="Consultando la flota en MobiControl…" />
      ) : flota.isError ? (
        <Aviso tipo="error">{(flota.error as Error).message}</Aviso>
      ) : (
        <div className="tarjeta tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <Encabezado columna="estado" orden={orden} alOrdenar={setOrden}>Estado</Encabezado>
                <Encabezado columna="nombre" orden={orden} alOrdenar={setOrden}>Equipo</Encabezado>
                <Encabezado columna="modelo" orden={orden} alOrdenar={setOrden}>Modelo</Encabezado>
                <Encabezado columna="bateria" orden={orden} alOrdenar={setOrden}>Batería</Encabezado>
                <Encabezado columna="ultimoReporte" orden={orden} alOrdenar={setOrden}>Último reporte</Encabezado>
                <Encabezado columna="grupo" orden={orden} alOrdenar={setOrden}>Grupo</Encabezado>
                <th>IMEI / Teléfono</th>
                <th>Zona</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
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
                      <span className="suave chico">Sin ubicación</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="vacio-lista suave">Ningún equipo coincide con los filtros.</p>}
        </div>
      )}
    </div>
  );
}
