

# Fase 3 — Funcionalidades Nuevas

## 3.1 Sistema de Notificaciones

**Base de datos:**
- Nueva tabla `notifications` con columnas: `id`, `account_id`, `user_id` (nullable, null = para todos los managers), `type` (STOCK_LOW, LEAVE_PENDING, INVOICE_OVERDUE, DELETE_REQUEST, etc.), `title`, `message`, `is_read`, `link` (ruta de navegación), `created_at`.
- RLS: usuarios ven sus propias notificaciones + las de account_id sin user_id si son managers.
- Habilitar realtime en la tabla.

**Frontend:**
- Componente `NotificationBell` en el header de `ClientLayout.tsx`: icono de campana con badge contador de no leídas.
- Dropdown con lista de notificaciones recientes, botón "marcar todas como leídas".
- Suscripción realtime para actualizar el contador sin refresh.

**Generación de notificaciones:**
- Edge function `generate_notifications` invocable por cron o manualmente que revisa:
  - `products` donde `current_stock < min_stock` → notificación STOCK_LOW
  - `leave_requests` con `status = PENDING` → notificación LEAVE_PENDING (a managers)
  - `invoices` con `status = SENT` y `issue_date` > 30 días → INVOICE_OVERDUE
  - `journal_entry_delete_requests` / `invoice_delete_requests` con `status = PENDING` → DELETE_REQUEST

---

## 3.2 Forgot Password

**Flujo:**
- Enlace "¿Olvidaste tu contraseña?" en `Login.tsx`.
- Nueva página `/forgot-password` con campo email que llama a `supabase.auth.resetPasswordForEmail()`.
- Nueva página `/reset-password` que captura el token del URL y permite establecer nueva contraseña con `supabase.auth.updateUser({ password })`.
- Configurar redirect URL en auth settings.

**Archivos nuevos:** `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`.
**Modificar:** `App.tsx` (rutas), `Login.tsx` (link).

---

## 3.3 Audit Log

**Base de datos:**
- Nueva tabla `audit_logs`: `id`, `account_id`, `user_id`, `action` (CREATE, UPDATE, DELETE), `entity_type` (invoice, journal_entry, employee, product, etc.), `entity_id`, `details` (jsonb con datos relevantes), `created_at`.
- RLS: managers pueden ver logs de su cuenta, master admin ve todo.

**Frontend:**
- Nueva pestaña "Actividad" en `AppSettings.tsx` o sección en Dashboard para managers.
- Tabla filtrable por tipo de entidad, acción y rango de fechas.

**Implementación:** Insertar registros de audit desde el frontend en cada mutación existente (create/update/delete de facturas, asientos, productos, empleados, etc.) mediante una función helper `logAudit()`.

---

## 3.4 Informes y Reportes

**Nueva página:** `src/pages/app/AppReports.tsx` accesible desde sidebar (nuevo módulo REPORTS o sección dentro de contabilidad).

**Reportes disponibles:**
- **P&L mensual/trimestral:** Reutiliza la lógica existente de PLTab pero con selección de rango y exportación PDF.
- **Informe de asistencia:** Horas por empleado en un período, con totales y promedios.
- **Valoración de inventario:** Productos con stock actual × coste unitario.
- **Resumen de facturación:** Facturas por estado, cliente, período.

**Exportación PDF:** Usar la misma técnica de `window.print()` ya usada en `InvoicePreviewDialog`, con layout optimizado para impresión.

---

## 3.5 Búsqueda Global (Cmd+K)

**Componente:** `src/components/shared/GlobalSearch.tsx` usando `cmdk` (ya instalado como dependencia).

**Funcionalidad:**
- Atajo Cmd+K / Ctrl+K abre command palette.
- Busca en: clientes (`business_clients`), facturas (`invoices`), productos (`products`), empleados (`employee_profiles`).
- Cada resultado navega a su módulo correspondiente.
- Secciones agrupadas por tipo de entidad.

**Integración:** Montar en `ClientLayout.tsx`, registrar el atajo de teclado.

---

## 3.7 Comentarios/Notas Internas

**Base de datos:**
- Nueva tabla `internal_notes`: `id`, `account_id`, `entity_type` (invoice, journal_entry, purchase_order), `entity_id`, `content`, `created_by`, `created_at`.
- RLS: usuarios de la misma cuenta pueden ver/crear notas.

**Frontend:**
- Componente reutilizable `NotesPanel` con lista de notas + input para añadir.
- Integrar en: `EditInvoiceDialog`, detalle de asiento contable, detalle de orden de compra.

---

## Orden de implementación recomendado

1. **3.2 Forgot Password** — Necesidad básica, rápido (~2 mensajes)
2. **3.5 Búsqueda Global** — Usa `cmdk` ya instalado, impacto UX alto (~2 mensajes)
3. **3.1 Notificaciones** — Requiere tabla + realtime + edge function (~4 mensajes)
4. **3.3 Audit Log** — Tabla + helper + integración en mutaciones (~3 mensajes)
5. **3.7 Notas internas** — Tabla + componente reutilizable (~2 mensajes)
6. **3.4 Reportes** — El más extenso, nueva página con múltiples vistas (~4 mensajes)

**Nota:** Se omite 3.6 (Multi-moneda) por baja prioridad y alto impacto en schema existente.

**Estimación total: ~17 mensajes**

