import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, PlugZap, XCircle } from "lucide-react";
import { actualizarVinculo, cambiarEstadoVinculo, comprobarVinculo, listarVinculos, type Comprobacion, type Vinculo } from "../api/plataforma";
import { Aviso, Cargando, Dialogo } from "../componentes/Basicos";
import { formatoFechaHora } from "../formato";

/**
 * Vínculos con One (solo plataforma). Las empresas aparecen solas cuando entra alguien de ellas;
 * aquí se les carga la credencial de One con la que Geomonitoreo lee su configuración.
 */
export function Vinculos() {
  const queryClient = useQueryClient();
  const vinculos = useQuery({ queryKey: ["vinculos"], queryFn: listarVinculos });
  const [editando, setEditando] = useState<Vinculo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [tenant, setTenant] = useState("");
  const [comprobaciones, setComprobaciones] = useState<Record<number, Comprobacion | "cargando">>({});
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => actualizarVinculo(editando!.empresaId, {
      oneTenantId: tenant.trim() || editando!.oneTenantId,
      oneApiKey: apiKey.trim() || null,
      oneApiSecret: apiSecret.trim() || null,
    }),
    onSuccess: () => {
      setEditando(null);
      void queryClient.invalidateQueries({ queryKey: ["vinculos"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const estado = useMutation({
    mutationFn: (v: Vinculo) => cambiarEstadoVinculo(v.empresaId, !v.activo),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vinculos"] }),
  });

  const comprobar = async (v: Vinculo) => {
    setComprobaciones((c) => ({ ...c, [v.empresaId]: "cargando" }));
    try {
      const r = await comprobarVinculo(v.empresaId);
      setComprobaciones((c) => ({ ...c, [v.empresaId]: r }));
    } catch {
      setComprobaciones((c) => ({ ...c, [v.empresaId]: { alcanzable: false } as Comprobacion }));
    }
  };

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <h1>Vínculos con One</h1>
          <p className="suave">
            Cada empresa necesita una credencial de Intechsys One para la app Geomonitoreo (One → Empresas → Geomonitoreo → Credenciales).
          </p>
        </div>
      </header>

      {vinculos.isLoading ? <Cargando /> : vinculos.isError ? (
        <Aviso tipo="error">{(vinculos.error as Error).message}</Aviso>
      ) : (
        <div className="tarjeta tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr><th>Empresa</th><th>Tenant</th><th>Credencial</th><th>Geocercas</th><th>Comprobación</th><th /></tr>
            </thead>
            <tbody>
              {(vinculos.data ?? []).map((v) => {
                const c = comprobaciones[v.empresaId];
                return (
                  <tr key={v.empresaId}>
                    <td>
                      <strong>{v.nombre}</strong>
                      <div className="suave chico">Desde {formatoFechaHora(v.fechaCreacion)}{!v.activo && " · inactiva"}</div>
                    </td>
                    <td><span className="mono chico">{v.oneSlug}</span></td>
                    <td>
                      {v.oneConfigurado
                        ? <span className="insignia" data-tono="ok"><CheckCircle2 aria-hidden /> Cargada</span>
                        : <span className="insignia" data-tono="aviso"><XCircle aria-hidden /> Falta</span>}
                    </td>
                    <td>{v.geocercas}</td>
                    <td>
                      {c === "cargando" ? <span className="suave chico">Comprobando…</span> : c ? (
                        c.alcanzable
                          ? <span className="insignia" data-tono={c.mobiControlConfigurado ? "ok" : "aviso"}>
                              {c.mobiControlConfigurado ? "One y MobiControl OK" : "One OK · sin MobiControl"}
                            </span>
                          : <span className="insignia" data-tono="peligro">One rechazó la credencial</span>
                      ) : (
                        <button type="button" className="boton chico" onClick={() => void comprobar(v)}><PlugZap aria-hidden /> Comprobar</button>
                      )}
                    </td>
                    <td className="acciones-fila">
                      <button type="button" className="boton chico" onClick={() => { setEditando(v); setApiKey(""); setApiSecret(""); setTenant(v.oneTenantId); setError(null); }}>
                        <KeyRound aria-hidden /> Credencial
                      </button>
                      <button type="button" className="boton chico fantasma" onClick={() => estado.mutate(v)}>
                        {v.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {vinculos.data?.length === 0 && (
            <p className="vacio-lista suave">Todavía no ha entrado nadie de ninguna empresa: los vínculos aparecen con el primer ingreso.</p>
          )}
        </div>
      )}

      <Dialogo
        abierto={!!editando}
        alCerrar={() => setEditando(null)}
        titulo={`Credencial de One · ${editando?.nombre ?? ""}`}
        acciones={
          <>
            <button type="button" className="boton" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="submit" form="form-vinculo" className="boton primario" disabled={guardar.isPending}>Guardar</button>
          </>
        }
      >
        <form id="form-vinculo" className="formulario" onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }}>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <label className="etiqueta">
            Api key
            <input className="campo mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={editando?.oneConfigurado ? "Sin cambios" : "one_live_…"} autoComplete="off" />
          </label>
          <label className="etiqueta">
            Secreto
            <input className="campo mono" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder={editando?.oneConfigurado ? "Sin cambios" : ""} autoComplete="new-password" />
          </label>
          <details>
            <summary className="suave chico">Avanzado: tenant de One</summary>
            <label className="etiqueta">
              Identificador del tenant
              <input className="campo mono" value={tenant} onChange={(e) => setTenant(e.target.value)} />
            </label>
          </details>
        </form>
      </Dialogo>
    </div>
  );
}
