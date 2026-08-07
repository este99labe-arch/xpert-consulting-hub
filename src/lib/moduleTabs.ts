import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Pestañas de cada módulo, ahora en el menú lateral.
 *
 * Vivían dentro de la propia pantalla, encima del contenido: eso dejaba dos
 * niveles de navegación compitiendo (el lateral y la barra de pestañas) y
 * empujaba el contenido hacia abajo. Al subirlas al lateral hay un único sitio
 * donde se navega.
 *
 * La primera de cada lista es la que se abre por defecto.
 */
export const MODULE_TABS: Record<string, { key: string; label: string }[]> = {
  INVOICES: [
    { key: "invoices", label: "Facturas" },
    { key: "quotes", label: "Presupuestos" },
    { key: "recurring", label: "Recurrentes" },
    { key: "reconciliation", label: "Conciliación" },
    { key: "import", label: "Importar" },
  ],
  ACCOUNTING: [
    { key: "dashboard", label: "Resumen" },
    { key: "chart", label: "Plan" },
    { key: "entries", label: "Asientos" },
    { key: "ledger", label: "Mayor" },
    { key: "pl", label: "P&L" },
    { key: "taxes", label: "IVA" },
  ],
  HR: [
    { key: "employees", label: "Empleados" },
    { key: "leave", label: "Ausencias" },
    { key: "calendar", label: "Calendario" },
    { key: "documents", label: "Docs" },
  ],
  INVENTORY: [
    { key: "products", label: "Productos" },
    { key: "movements", label: "Movimientos" },
    { key: "alerts", label: "Alertas" },
    { key: "orders", label: "Órdenes" },
  ],
  REPORTS: [
    { key: "pl", label: "PyG" },
    { key: "invoices", label: "Facturación" },
    { key: "attendance", label: "Asistencia" },
    { key: "inventory", label: "Inventario" },
    { key: "tasks", label: "Tareas" },
  ],
};

/**
 * Pestaña activa, guardada en la URL (`?tab=`).
 *
 * En la URL y no en un useState para que el menú lateral y la pantalla no
 * puedan discrepar, y de paso el enlace a una pestaña concreta se pueda
 * compartir y sobreviva a recargar la página.
 */
export const useModuleTab = (defaultKey: string): [string, (key: string) => void] => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || defaultKey;

  const setTab = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      if (key === defaultKey) next.delete("tab");
      else next.set("tab", key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, defaultKey],
  );

  return [tab, setTab];
};
