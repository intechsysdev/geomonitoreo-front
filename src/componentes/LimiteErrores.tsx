import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Si una pantalla falla al dibujarse, React desmonta todo y queda la página vacía (negra con el
 * tema oscuro). Esto lo contiene: se dice qué pasó y se ofrece recargar, sin perder la consola.
 */
export class LimiteErrores extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("La pantalla falló:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="pantalla-paso">
        <div className="paso-sso tarjeta" role="alert">
          <h2>Esta pantalla no se pudo mostrar</h2>
          <p className="suave">{this.state.error.message}</p>
          <div className="fila-botones">
            <button type="button" className="boton primario" onClick={() => window.location.reload()}>Recargar</button>
          </div>
        </div>
      </div>
    );
  }
}
