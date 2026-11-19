/** Proporciones de los SVG de la marca, para que el lugar quede reservado antes de que carguen. */
const PIEZAS = {
  /** Horizontal, sin lema: para la pantalla de entrada (no menos de 360 px de ancho). */
  logo: { ancho: 942, alto: 342 },
  /** Compacta (isotipo + "one"), vertical: para los espacios chicos. */
  marca: { ancho: 545, alto: 757 },
};

/**
 * Marca oficial de INTECHSYS ONE. Va en sus dos variantes y el CSS muestra la del tema (el del
 * sistema o el fijado en data-tema), así no hay que esperar a React para elegirla. Es una
 * imagen y no SVG en línea: los ids internos de los archivos chocarían entre sí.
 */
export function Marca({ pieza, alt = "INTECHSYS ONE", className }: { pieza: keyof typeof PIEZAS; alt?: string; className?: string }) {
  const { ancho, alto } = PIEZAS[pieza];
  return (
    <span className={className ? `marca-oficial ${className}` : "marca-oficial"}>
      <img src={`/marca/${pieza}.svg`} width={ancho} height={alto} alt={alt} className="variante-clara" />
      <img src={`/marca/${pieza}-oscuro.svg`} width={ancho} height={alto} alt={alt} className="variante-oscura" />
    </span>
  );
}

/**
 * Marca del producto, igual a la de WorkLog: el isotipo y "one" de INTECHSYS ONE, un separador y
 * el nombre de la app sobre su descripción. `compacta` deja solo el isotipo y "one".
 */
export function MarcaProducto({ compacta = false, className }: { compacta?: boolean; className?: string }) {
  return (
    <div className={className ? `marca-producto ${className}` : "marca-producto"}>
      <div role="img" aria-label="INTECHSYS ONE" className="marca-producto-one">
        <img src="/favicon.svg" alt="" width={30} height={31} />
        <span aria-hidden>one</span>
      </div>
      {!compacta && (
        <>
          <span aria-hidden className="marca-producto-separador" />
          <span className="marca-producto-textos">
            <span className="marca-producto-nombre">Track</span>
            <span className="marca-producto-descripcion">Geolocalización</span>
          </span>
        </>
      )}
    </div>
  );
}
