import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProveedorTema } from "./tema/Tema";
import { ProveedorSesion } from "./sesion/SesionContexto";
import { ErrorApi } from "./api/cliente";
import App from "./App";
import "./index.css";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 4xx no se arregla reintentando (falta configuración, no hay permiso): se muestra ya.
      retry: (fallos, error) => !(error instanceof ErrorApi && error.estado < 500) && fallos < 2,
      refetchOnWindowFocus: false,
    },
  },
});

// El navegador sin Popover API (menú de la cuenta) recibe el polyfill; los demás, nada.
if (!("popover" in HTMLElement.prototype)) {
  void import("@oddbird/popover-polyfill");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProveedorTema>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ProveedorSesion>
            <App />
          </ProveedorSesion>
        </BrowserRouter>
      </QueryClientProvider>
    </ProveedorTema>
  </StrictMode>,
);
