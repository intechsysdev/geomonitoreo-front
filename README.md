# geomonitoreo-front

Consola de **Geomonitoreo**: la flota de MobiControl en un mapa vectorial, en vivo.

React 19 · Vite · TypeScript · Google Maps JavaScript API (marcadores avanzados, Places para buscar direcciones) · TanStack Query.

La key de Google Maps es de cada empresa: variable `GOOGLE_MAPS_API_KEY` de Geomonitoreo en Intechsys One (y `GOOGLE_MAPS_MAP_ID`, opcional). Necesita Maps JavaScript API, Places API (New) y Geocoding API, restringida por dominio a la consola.

## Pantallas

- **Monitor en vivo**: mapa a pantalla completa con los equipos agrupados por cercanía y coloreados por estado; indicadores que filtran (en línea, inactivos, sin señal, batería baja, sin ubicación), búsqueda, detalle del equipo y "pedir ubicación". Se refresca cada 30 s.
- **Dispositivos**: inventario en tabla, con orden, filtros y exportación a CSV.
- **Recorridos**: el recorrido de un equipo (hoy, ayer, 7 días o rango) coloreado por velocidad, con paradas, entradas y salidas de geocercas y reproducción.
- **Geocercas**: dibujar círculos y polígonos sobre el mapa; cuántos equipos hay dentro de cada una.
- **Vínculos** (plataforma): credencial de Intechsys One de cada empresa.

Tema claro/oscuro según el sistema (con interruptor), y el mapa lo sigue.

## Sesión

Los tokens los emite **Intechsys One**: "Entrar con One" (SSO) o usuario y contraseña de One. Mismo manejo que firma-digital: las pestañas abiertas siguen la sesión, y cerrar sesión en One cierra también aquí.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 (el origen que One de producción acepta), /api → http://localhost:5240
```

Variables (`.env`): `VITE_API_PROXY`, `VITE_ONE_URL`, `VITE_ONE_PORTAL_URL`. En producción, `VITE_API_URL` con la URL del API.

## Despliegue

`.github/workflows/deploy.yml` publica en un Static Web App. Queda inactivo hasta configurar en el repositorio la variable `GEO_API_URL` y el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`.
