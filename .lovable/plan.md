

# Fase 2 — UX y Diseño

## 2.1 Dashboard Enriquecido

**Archivo:** `src/pages/app/AppDashboard.tsx`

El dashboard actual solo muestra datos de facturación. Se enriquecerá con widgets de cada módulo activo, consultando `account_modules` para mostrar solo los relevantes:

- **Empleados fichados hoy** — Query a `attendance_records` donde `work_date = today`. Muestra "X de Y fichados".
- **Stock bajo** — Query a `products` donde `current_stock < min_stock`. Muestra contador con icono de alerta.
- **Solicitudes pendientes** — Query a `leave_requests` + `invoice_delete_requests` + `journal_entry_delete_requests` con `status = PENDING`. Solo visible para Managers.
- **Balance contable del mes** — Query a `journal_entry_lines` JOIN `journal_entries` del mes actual, sumando débitos y créditos.

Layout: Segunda fila de cards compactas debajo de los KPIs financieros actuales, con iconos y links directos al módulo correspondiente.

---

## 2.2 Tablas Responsive

Crear componente `src/components/shared/ResponsiveTable.tsx` que:
- En desktop (md+): renderiza `<Table>` normal
- En móvil (<md): renderiza cada fila como una `<Card>` con layout vertical (label: value)

Props: `columns`, `data`, `renderMobileCard`. Se aplicará a: AppClients, AppInvoices, JournalEntriesTab, ProductsTab, MovementsTab, PurchaseOrdersTab, EmployeesTab, LeaveTab.

Alternativa más simple: usar clases `hidden md:table-cell` para ocultar columnas secundarias en móvil y añadir un diseño compacto a las filas visibles.

---

## 2.3 Breadcrumbs

**Archivo:** `src/layouts/ClientLayout.tsx` (header)

Componente `src/components/shared/Breadcrumbs.tsx` que lee `useLocation()` y mapea la ruta actual a un breadcrumb legible:
- `/app/dashboard` → `Dashboard`
- `/app/accounting` → `Contabilidad`

Se inserta en el `<header>` del layout, junto al `SidebarTrigger`.

---

## 2.4 Estados Vacíos Unificados

**Archivo:** `src/components/shared/EmptyState.tsx`

Componente reutilizable con props: `icon`, `title`, `description`, `action` (botón opcional). Reemplazar los estados vacíos ad-hoc en AppClients, AppInvoices, cada tab de inventario/contabilidad/HR.

---

## 2.5 Confirmación de Eliminación Unificada

**Archivo:** `src/components/shared/DeleteConfirmDialog.tsx`

Componente `AlertDialog` reutilizable. Props: `open`, `onConfirm`, `onCancel`, `title`, `description`, `loading`. Reemplazar el `confirm()` nativo en `AppClients.tsx` y cualquier otro lugar que use `window.confirm`.

---

## 2.6 Filtro por Rango de Fechas

**Archivo:** `src/components/shared/DateRangePicker.tsx`

Componente con dos `Calendar` (react-day-picker) en un Popover, devuelve `{ from: Date, to: Date }`. Se aplicará a:
- Dashboard (cambiar de "últimos 7 días" fijo a rango seleccionable)
- Facturas (filtrar por fecha de emisión)
- Contabilidad: Libro Mayor, PyG

---

## 2.7 Header con Perfil de Usuario

**Modificar:** `src/layouts/ClientLayout.tsx`

Enriquecer el header (actualmente solo tiene `SidebarTrigger`) con:
- Breadcrumbs (2.3) a la izquierda
- A la derecha: Avatar con inicial + nombre/rol + dropdown con "Mi perfil" (link a Settings) y "Cerrar sesión"

---

## Orden de implementación recomendado

1. **2.4 + 2.5** — EmptyState + DeleteConfirmDialog (componentes base reutilizables, rápidos)
2. **2.3 + 2.7** — Breadcrumbs + Header con perfil (mejora navegación inmediata)
3. **2.1** — Dashboard enriquecido (impacto visual alto, requiere queries nuevas)
4. **2.6** — DateRangePicker (mejora funcional en varios módulos)
5. **2.2** — Responsive tables (el más extenso, toca muchos archivos)

**Estimación total: ~12-15 mensajes**

