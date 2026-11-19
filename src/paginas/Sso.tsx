import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { completarSso, iniciarSso, ssoDisponible } from "../api/sso";
import { AvisoPaso, MarcoPaso, PasoEnCurso } from "../componentes/MarcoPaso";

/**
 * Ruta de inicio que se registra en One como "URL de inicio" de la app. Es a donde lleva la
 * tarjeta de "Mis aplicaciones", con la empresa elegida allá en ?tenant=.
 */
export function SsoInicio() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (!ssoDisponible() || iniciado.current) return;
    iniciado.current = true;

    iniciarSso(params.get("tenant"), params.get("cuenta") === "elegir").catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la sesión con INTECHSYS ONE.");
    });
  }, [params]);

  if (!ssoDisponible()) {
    return (
      <MarcoPaso titulo="El inicio de sesión único no está configurado">
        <AvisoPaso>Faltan VITE_ONE_URL y VITE_ONE_PORTAL_URL.</AvisoPaso>
        <Link to="/" className="paso-enlace">Volver</Link>
      </MarcoPaso>
    );
  }

  return error ? <Fallo mensaje={error} /> : <PasoEnCurso titulo="Conectando con INTECHSYS ONE…" />;
}

/** Dirección de retorno registrada en One: aquí llega el código y se canjea por la sesión. */
export function SsoRetorno() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const canjeado = useRef(false);

  useEffect(() => {
    // El código sirve una sola vez: el segundo montaje de StrictMode lo gastaría y fallaría.
    if (canjeado.current) return;
    canjeado.current = true;

    completarSso(params)
      // Recarga completa y no navegación: la sesión se lee del almacenamiento al arrancar.
      .then(() => window.location.replace("/monitor"))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudo completar el inicio de sesión con INTECHSYS ONE.");
      });
  }, [params]);

  return error ? <Fallo mensaje={error} /> : <PasoEnCurso titulo="Terminando de entrar…" />;
}

function Fallo({ mensaje }: { mensaje: string }) {
  return (
    <MarcoPaso titulo="No pudimos completar el inicio de sesión">
      <AvisoPaso>{mensaje}</AvisoPaso>
      <button type="button" className="boton primario grande" onClick={() => void iniciarSso(null)}>
        Intentar de nuevo
      </button>
    </MarcoPaso>
  );
}
