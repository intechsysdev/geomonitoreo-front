import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Vite no vuelca el .env en process.env para este archivo: se carga a mano. El tercer
  // argumento vacío incluye las variables sin prefijo VITE_; el destino del proxy nunca llega
  // al navegador.
  const entorno = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      // 5173 es el origen de desarrollo que One de producción acepta por CORS: el login y la
      // renovación del token se le piden directo a One, sin pasar por el proxy.
      port: 5173,
      // En desarrollo /api se reenvía al API: el navegador lo ve como mismo origen.
      proxy: {
        "/api": {
          target: entorno.VITE_API_PROXY || "http://localhost:5240",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
