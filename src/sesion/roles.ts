/** One emite el rol con su nombre interno; aquí se muestra como lo nombra el portal. */
const ROLES: Record<string, string> = {
  Owner: "Propietario",
  Admin: "Administrador",
  Member: "Miembro",
  Viewer: "Observador",
};

export function nombreRol(rol: string): string {
  return ROLES[rol] ?? rol;
}
