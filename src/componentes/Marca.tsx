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
