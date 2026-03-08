

## Plan: Módulo de Contabilidad Completo

### Contexto

Actualmente `/app/accounting` muestra un placeholder. El módulo se construirá sobre los datos existentes de `invoices` (ingresos/gastos) e integrará un sistema contable completo con plan de cuentas, asientos, libros y reportes fiscales.

---

### 1. Base de datos (3 tablas nuevas + 1 migración)

**`chart_of_accounts`** — Plan contable por cuenta
- `id`, `account_id`, `code` (ej: "700", "400"), `name`, `type` (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE), `parent_id` (FK self, nullable), `is_active`, `created_at`
- Se pre-cargará con un plan contable español básico via seed (cuentas 100-799)

**`journal_entries`** — Asientos contables
- `id`, `account_id`, `entry_number` (auto-generado), `date`, `description`, `invoice_id` (FK invoices, nullable — enlaza asientos automáticos), `status` (DRAFT, POSTED), `created_by`, `created_at`

**`journal_entry_lines`** — Líneas de cada asiento (partida doble)
- `id`, `entry_id` (FK journal_entries), `chart_account_id` (FK chart_of_accounts), `debit`, `credit`, `description`

**Trigger**: al crear/editar una factura, generar automáticamente el asiento contable correspondiente (ej: Factura de ingreso → Debe: 430 Clientes / Haber: 700 Ventas + 477 IVA Repercutido).

**RLS**: misma estrategia multi-tenant existente con `get_user_account_id` y `has_role`.

---

### 2. Página `AppAccounting.tsx` — 6 pestañas

**Pestaña "Resumen"** — Dashboard contable
- KPIs: Ingresos totales, Gastos totales, Resultado neto, IVA a liquidar
- Gráfico de evolución mensual (ingresos vs gastos, 12 meses)
- Gráfico de distribución por categoría contable (pie/donut)

**Pestaña "Plan Contable"**
- Árbol jerárquico de cuentas (agrupadas por tipo: Activo, Pasivo, Patrimonio, Ingresos, Gastos)
- Búsqueda por código o nombre
- CRUD para managers (crear cuenta, editar, desactivar)
- Saldo actual calculado de cada cuenta

**Pestaña "Asientos"**
- Listado de asientos con filtros por fecha, estado y cuenta
- Asientos automáticos (desde facturas, marcados con icono enlace)
- Crear asiento manual con N líneas (debe = haber obligatorio)
- Cambiar estado: Borrador → Contabilizado
- Los employees solo lectura

**Pestaña "Libro Mayor"**
- Selector de cuenta contable
- Rango de fechas
- Tabla con: fecha, nº asiento, descripción, debe, haber, saldo acumulado
- Exportación CSV

**Pestaña "Resultados"** — Cuenta de Pérdidas y Ganancias
- Selector de periodo (mes, trimestre, año)
- Ingresos desglosados por cuenta (700, 701...)
- Gastos desglosados por cuenta (600, 621, 625...)
- Resultado del ejercicio
- Exportación CSV

**Pestaña "Impuestos"** — Resumen IVA
- Selector de trimestre (Q1-Q4)
- IVA Repercutido (ventas) desglosado por tipo (4%, 10%, 21%)
- IVA Soportado (compras) desglosado por tipo
- Resultado: IVA a ingresar o a devolver
- Base imponible total por cada tramo
- Exportación CSV para modelo 303

**Master Admin**: selector de cliente antes del contenido (mismo patrón que Inventario).

---

### 3. Integración con Facturación

- Cuando se crea/actualiza una factura, se genera/actualiza el asiento contable automáticamente
- Factura de ingreso: Debe 430 (Clientes) / Haber 700 (Ventas) + 477 (IVA Repercutido)
- Gasto: Debe 600 (Compras) + 472 (IVA Soportado) / Haber 400 (Proveedores)
- Al eliminar factura, se elimina el asiento vinculado

---

### 4. Plan contable español por defecto (seed)

Se insertarán ~25 cuentas básicas al activar el módulo:
- 100 Capital, 129 Resultado del ejercicio
- 400 Proveedores, 410 Acreedores, 430 Clientes
- 472 IVA Soportado, 477 IVA Repercutido
- 570 Caja, 572 Bancos
- 600 Compras, 621 Arrendamientos, 625 Seguros, 628 Suministros, 629 Otros gastos
- 640 Sueldos, 642 Seguridad Social
- 700 Ventas de mercancías, 705 Prestaciones de servicios, 759 Otros ingresos

---

### 5. Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/pages/app/AppAccounting.tsx` (página principal con 6 tabs) |
| Crear | Migración SQL: 3 tablas + trigger auto-asientos + seed plan contable + RLS |
| Modificar | `src/App.tsx` (ruta ya apunta a AppPlaceholder, redirigir a nuevo componente) |
| Insertar | Registro `ACCOUNTING` en `service_modules` si no existe |

---

### 6. Notas técnicas

- Los cálculos de Libro Mayor y P&L se harán en cliente (sumando líneas de asientos filtradas) dado el volumen esperado por tenant
- El trigger de auto-asientos será una función PL/pgSQL `SECURITY DEFINER` que se ejecuta `AFTER INSERT OR UPDATE ON invoices`
- Las líneas de asiento usarán `numeric` para debe/haber (consistente con la tabla invoices)
- El componente será ~800-1000 líneas, similar al patrón de AppInventory con tabs internos

