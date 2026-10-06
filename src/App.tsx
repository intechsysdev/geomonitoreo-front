import { Navigate, Route, Routes } from "react-router-dom";
import { Marco } from "./componentes/Marco";
import { Aviso, Cargando } from "./componentes/Basicos";
import { useSesion } from "./sesion/SesionContexto";
import { Login } from "./paginas/Login";
import { SsoInicio, SsoRetorno } from "./paginas/Sso";
import { Monitor } from "./paginas/Monitor";
import { Dispositivos } from "./paginas/Dispositivos";
import { Recorridos } from "./paginas/Recorridos";
import { Geocercas } from "./paginas/Geocercas";
import { Vinculos } from "./paginas/Vinculos";

export default function App() {
  return (
    <Routes>
      {/* Entrada con One: la tarjeta de "Mis aplicaciones" abre /sso y One devuelve a /sso/callback. */}
      <Route path="/sso" element={<SsoInicio />} />
      <Route path="/sso/callback" element={<SsoRetorno />} />
      <Route path="*" element={<Consola />} />
    </Routes>
  );
}

function Consola() {
  const { autenticado, sesion, errorSesion, reintentarSesion, empresaActiva, esAdministradorPlataforma, salir } = useSesion();

  if (!autenticado) return <Login />;

  if (!sesion && errorSesion) {
    return (
      <div className="pantalla-paso">
        <div className="paso-sso tarjeta">
          <h2>No se pudo preparar la consola</h2>
          <p className="suave">{errorSesion}</p>
          <div className="fila-botones">
            <button type="button" className="boton primario" onClick={reintentarSesion}>Reintentar</button>
            <button type="button" className="boton" onClick={salir}>Volver al inicio de sesión</button>
          </div>
        </div>
      </div>
    );
  }

  if (!sesion) return <div className="pantalla-paso"><Cargando texto="Preparando el mapa…" /></div>;

  if (sesion.empresas.length === 0) {
    return (
      <Marco>
        <div className="pagina">
          <Aviso tipo="alerta">
            <strong>Tu cuenta no alcanza ninguna empresa.</strong> Ninguna de tus empresas en Intechsys One tiene asignada
            la app Geomonitoreo. Pide al administrador de la plataforma que la asigne o que te agregue a una empresa que la tenga.
          </Aviso>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      {!empresaActiva ? (
        <div className="pagina">
          <Aviso>Elige una empresa arriba para ver su flota.</Aviso>
          {esAdministradorPlataforma && (
            <Routes>
              <Route path="/vinculos" element={<Vinculos />} />
            </Routes>
          )}
        </div>
      ) : (
        // La clave es la empresa: al cambiarla, cada pantalla se monta de nuevo con sus datos.
        <Routes key={empresaActiva.oneTenantId}>
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/dispositivos" element={<Dispositivos />} />
          <Route path="/recorridos" element={<Recorridos />} />
          <Route path="/geocercas" element={<Geocercas />} />
          <Route path="/vinculos" element={esAdministradorPlataforma ? <Vinculos /> : <Navigate to="/monitor" replace />} />
          <Route path="*" element={<Navigate to="/monitor" replace />} />
        </Routes>
      )}
    </Marco>
  );
}
