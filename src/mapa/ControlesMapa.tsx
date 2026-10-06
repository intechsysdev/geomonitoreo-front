import type { Map as MapaLibre } from "maplibre-gl";
import { Focus, Layers, Minus, Plus } from "lucide-react";
import { FONDOS, type FondoMapa } from "./estilos";

/** Fondo, zoom y encuadre: los controles del mapa, con el mismo vidrio de los paneles. */
export function ControlesMapa({
  mapa,
  fondo,
  alCambiarFondo,
  alEncuadrar,
}: {
  mapa: MapaLibre | null;
  fondo: FondoMapa;
  alCambiarFondo: (fondo: FondoMapa) => void;
  alEncuadrar?: () => void;
}) {
  return (
    <div className="controles-mapa">
      <div className="segmentado vidrio" role="group" aria-label="Fondo del mapa">
        <Layers aria-hidden className="controles-icono" />
        {FONDOS.map((f) => (
          <button key={f.id} type="button" aria-pressed={fondo === f.id} onClick={() => alCambiarFondo(f.id)}>
            {f.nombre}
          </button>
        ))}
      </div>

      <div className="controles-pila vidrio">
        <button type="button" aria-label="Acercar" onClick={() => mapa?.zoomIn()}><Plus aria-hidden /></button>
        <button type="button" aria-label="Alejar" onClick={() => mapa?.zoomOut()}><Minus aria-hidden /></button>
        {alEncuadrar && (
          <button type="button" aria-label="Encuadrar todo" onClick={alEncuadrar}><Focus aria-hidden /></button>
        )}
      </div>
    </div>
  );
}
