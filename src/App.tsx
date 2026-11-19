import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2, LogOut, RotateCw } from "lucide-react";
import { Marco } from "./componentes/Marco";
import { LimiteErrores } from "./componentes/LimiteErrores";
import { AvisoPaso, MarcoPaso } from "./componentes/MarcoPaso";
import { useSesion } from "./sesion/SesionContexto";
import { Login } from "./paginas/Login";
import { ElegirEmpresa } from "./paginas/ElegirEmpresa";
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
  const { autenticado, correo, sesion, errorSesion, reintentarSesion, empresaActiva, esAdministradorPlataforma, salir } =
    useSesion();
  const { pathname } = useLocation();

  if (!autenticado) return <Login />;

  // Las pantallas de antes de la consola son las de WorkLog: error al cargar el perfil, la espera
  // y la cuenta sin acceso.
  if (!sesion && errorSesion) {
    return (
      <MarcoPaso titulo="No pudimos cargar tu perfil" descripcion={correo}>
        <AvisoPaso>{errorSesion}</AvisoPaso>
        <div className="paso-botones">
          <button type="button" className="boton primario" onClick={reintentarSesion}>
            <RotateCw aria-hidden />
            Reintentar
          </button>
          <button type="button" className="boton fantasma" onClick={salir}>
            <LogOut aria-hidden />
            Salir
          </button>
        </div>
      </MarcoPaso>
    );
  }

  if (!sesion) {
    return (
      <div className="marco-paso" role="status">
        <Loader2 className="paso-girador" aria-hidden />
        <span className="visualmente-oculto">Cargando tu perfil</span>
      </div>
    );
  }

  if (sesion.empresas.length === 0) {
    return (
      <MarcoPaso titulo="No tienes acceso a Track" descripcion={correo}>
        <AvisoPaso>
          Ninguna de las empresas a las que perteneces en One tiene asignada la app Track. Pide al
          administrador de la plataforma que se la asigne a tu empresa o que te agregue como miembro
          de una que ya la tenga.
        </AvisoPaso>
        <div className="paso-botones">
          <button type="button" className="boton fantasma" onClick={salir}>
            <LogOut aria-hidden />
            Salir
          </button>
        </div>
      </MarcoPaso>
    );
  }

  // Con varias empresas y ninguna elegida (la sesión ya usó la que mandó One, la guardada o la
  // única) se pregunta antes de entrar. Al administrador de plataforma también: sin empresa no
  // hay flota que mostrarle, y Vínculos le queda en el menú una vez elegida.
  if (!empresaActiva) return <ElegirEmpresa />;

  return (
    <Marco>
      {/* La clave es la empresa: al cambiarla, cada pantalla se monta de nuevo con sus datos. El
          límite de errores se reinicia al cambiar de pantalla: una que falló no tumba las demás. */}
      <LimiteErrores key={pathname}>
        <Routes key={empresaActiva.oneTenantId}>
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/dispositivos" element={<Dispositivos />} />
          <Route path="/recorridos" element={<Recorridos />} />
          <Route path="/geocercas" element={<Geocercas />} />
          <Route path="/vinculos" element={esAdministradorPlataforma ? <Vinculos /> : <Navigate to="/monitor" replace />} />
          <Route path="*" element={<Navigate to="/monitor" replace />} />
        </Routes>
      </LimiteErrores>
    </Marco>
  );
}
