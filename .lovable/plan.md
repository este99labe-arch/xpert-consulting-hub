

## Plan: Módulo de Inventario / Gestión de Stock

### Resumen

Crear un módulo completo de inventario que permita gestionar productos, controlar stock, configurar alertas de stock bajo, y planificar compras. Accesible según rol (Employee solo lectura, Manager gestión completa, Master Admin por cliente).

---

### 1. Base de datos (3 tablas nuevas)

**`products`** — Catálogo de productos por cuenta
- `id`, `account_id`, `name`, `sku` (código único), `description`, `category`, `unit` (unidad de medida: uds, kg, litros...), `min_stock` (umbral de alerta), `current_stock`, `cost_price`, `sale_price`, `is_active`, `created_at`, `updated_at`

**`stock_movements`** — Registro de cada entrada/salida de stock
- `id`, `account_id`, `product_id` (FK products), `type` (IN / OUT / ADJUSTMENT), `quantity`, `reason` (compra, venta, merma, ajuste manual...), `notes`, `created_by` (user_id), `created_at`
- Un trigger actualizará `products.current_stock` automáticamente con cada movimiento.

**`purchase_orders`** — Planificación de compras
- `id`, `account_id`, `product_id` (FK products), `quantity`, `status` (DRAFT / PENDING / ORDERED / RECEIVED), `estimated_date`, `notes`, `created_by`, `created_at`, `updated_at`

RLS: misma estrategia multi-tenant (users ven su cuenta, managers gestionan, master admin ve todo).

---

### 2. Módulo de servicio

Insertar un nuevo registro en `service_modules`:
- code: `INVENTORY`, name: `Inventario`

Esto permite activarlo/desactivarlo por cliente desde el panel Master.

---

### 3. Página `AppInventory.tsx` — Layout con 4 pestañas

**Pestaña "Productos"**
- Tabla con: nombre, SKU, categoría, stock actual, stock mínimo, precio coste/venta, estado
- Indicador visual: rojo si `current_stock <= min_stock`, amarillo si está cerca (ej. < 1.5x min)
- Búsqueda por nombre/SKU, filtro por categoría y estado
- Dialog para crear/editar producto
- Employees: solo lectura; Managers: CRUD completo

**Pestaña "Movimientos"**
- Historial de entradas/salidas con filtros por producto, tipo y fecha
- Botón para registrar movimiento manual (entrada, salida, ajuste)
- Cada movimiento actualiza `current_stock` vía trigger DB

**Pestaña "Alertas"**
- Lista de productos cuyo `current_stock <= min_stock`
- Ordenados por urgencia (los más bajos primero)
- Acción rápida: crear orden de compra desde la alerta

**Pestaña "Órdenes de Compra"**
- Lista de órdenes con estado, producto, cantidad, fecha estimada
- Flujo de estados: Borrador → Pendiente → Pedido → Recibido
- Al marcar como "Recibido", se genera automáticamente un movimiento de tipo IN

**Master Admin**: selector de cliente (como en Asistencia) antes de ver el contenido.

---

### 4. Funcionalidades adicionales sugeridas

1. **Dashboard de inventario** con tarjetas resumen: total productos, productos con stock bajo, valor total del inventario (sum de `current_stock * cost_price`), movimientos del mes
2. **Exportación CSV** de productos y movimientos para reporting externo
3. **Historial de precios** — se podría registrar cambios de `cost_price` en los movimientos para análisis de costes
4. **Categorías personalizables** — en vez de texto libre, una tabla `product_categories` por cuenta para consistencia

Para esta primera versión implementaré las 4 pestañas principales + dashboard resumen + exportación CSV. Las categorías personalizables y el historial de precios se pueden añadir después.

---

### 5. Routing y sidebar

- Añadir ruta `/app/inventory` en `App.tsx`
- Añadir `INVENTORY: Package` (icono) y `INVENTORY: "/app/inventory"` en `ClientLayout.tsx`

---

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/pages/app/AppInventory.tsx` |
| Modificar | `src/App.tsx` (nueva ruta) |
| Modificar | `src/layouts/ClientLayout.tsx` (icono + path) |
| Migración | 3 tablas + trigger + RLS policies |
| Insert | Registro en `service_modules` |

