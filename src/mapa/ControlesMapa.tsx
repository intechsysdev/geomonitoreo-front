import { Focus, Layers, MapPinned, Minus, Plus } from "lucide-react";
import { FONDOS, type FondoMapa } from "./estilos";

/** Fondo, zoom y encuadre: los controles del mapa, con el mismo vidrio de los paneles. */
export function ControlesMapa({
  mapa,
  fondo,
  alCambiarFondo,
  alEncuadrar,
}: {
  mapa: google.maps.Map | null;
  fondo: FondoMapa;
  alCambiarFondo: (fondo: FondoMapa) => void;
  alEncuadrar?: () => void;
}) {
  const zoom = (paso: number) => mapa?.setZoom((mapa.getZoom() ?? 11) + paso);

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
        <button type="button" aria-label="Acercar" onClick={() => zoom(1)}><Plus aria-hidden /></button>
        <button type="button" aria-label="Alejar" onClick={() => zoom(-1)}><Minus aria-hidden /></button>
        {alEncuadrar && (
          <button type="button" aria-label="Encuadrar todo" onClick={alEncuadrar}><Focus aria-hidden /></button>
        )}
      </div>
    </div>
  );
}

/** Lo que se ve en lugar del mapa cuando no se puede mostrar (sin key, key rechazada…). */
export function AvisoMapa({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div className="aviso-mapa" role="status">
      <MapPinned aria-hidden />
      <p>{texto}</p>
    </div>
  );
}
