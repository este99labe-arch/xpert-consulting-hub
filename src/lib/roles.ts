// Etiquetas legibles para los códigos de rol del sistema.
export const ROLE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Administrador",
  MANAGER: "Manager",
  EMPLOYEE: "Empleado",
};

export const roleLabel = (code?: string | null): string =>
  (code && ROLE_LABELS[code]) || code || "—";
