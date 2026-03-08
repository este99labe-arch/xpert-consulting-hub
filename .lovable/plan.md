
# Plan de Desarrollo — XpertConsulting ERP

## Estado Actual (Resumen)

ERP multi-tenant con 8 módulos funcionales: Dashboard, Clientes, Facturación, Contabilidad, RRHH, Asistencia, Inventario y Configuración. Sistema de roles (MASTER_ADMIN, MANAGER, EMPLOYEE), RLS en todas las tablas, activación modular por cuenta.

---

## 🔍 Análisis Detallado

### ✅ Lo que funciona bien
- Arquitectura multi-tenant sólida con RLS
- Sistema de roles y permisos consistente
- Flujos de aprobación (eliminación de facturas/asientos para empleados)
- Design system coherente (tokens CSS, dark mode)
- Edge Functions seguras con validación de caller
- Módulos activables/desactivables por cuenta

### ⚠️ Problemas Detectados

#### 1. Arquitectura / Código
- **Archivos monolíticos**: `AppAccounting.tsx` (1386 líneas), `AppHR.tsx` (981 líneas), `AppInventory.tsx` (774 líneas), `AppAttendance.tsx` (670 líneas). Dificulta mantenimiento y testing.
- **Sin paginación**: Todas las tablas cargan todos los registros. Con volumen alto provocará problemas de rendimiento (límite de 1000 filas de Supabase).
- **Tipado parcial**: Uso extensivo de `any` en vez de tipos del schema generado (`Tables<"invoices">`, etc.).
- **Lógica duplicada**: Selector de cuenta para Master Admin repetido en cada módulo. Patrón de exportación CSV duplicado.
- **Sin error boundaries**: Un error en un componente hijo tumba toda la página.

#### 2. Seguridad
- **`AppClients.tsx` usa `confirm()` nativo** para eliminación — no hay control real ni confirmación segura.
- **Sin rate limiting** en edge functions (crear usuarios, reset password).
- **Sin validación de inputs** del lado servidor en varias edge functions (ej: longitud de password, formato de email).
- **Sin audit log**: No hay registro de quién hizo qué cambio y cuándo.

#### 3. UX / Diseño
- **Dashboard limitado**: Solo muestra datos de facturación. No integra info de RRHH, asistencia, inventario.
- **Sin breadcrumbs** ni indicación clara de ubicación en la navegación.
- **Sin estados vacíos consistentes**: Algunos módulos tienen, otros no.
- **Sin modo responsive completo**: Las tablas no se adaptan bien a móvil.
- **Sin notificaciones**: No hay sistema de alertas internas (stock bajo, solicitudes pendientes, etc.).
- **Sin feedback de carga por sección**: Loading spinner genérico en vez de skeletons.

#### 4. Funcionalidad ausente
- **Sin recuperación de contraseña** (forgot password flow)
- **Sin perfil de usuario** accesible desde el sidebar
- **Sin filtros por fecha** en Dashboard
- **Sin reportes/informes** exportables (solo CSV básico en algunos módulos)
- **Sin multi-idioma** (todo hardcodeado en español)
- **Sin búsqueda global** entre módulos
- **Sin actividad/historial** (audit trail)

---

## 📋 Plan de Desarrollo (por fases)

### Fase 1 — Estabilidad y Refactor (Prioridad Alta)
> Objetivo: Código mantenible, rendimiento óptimo, seguridad robusta

| # | Tarea | Impacto |
|---|-------|---------|
| 1.1 | **Refactor: Extraer componentes** — Dividir archivos monolíticos en componentes reutilizables (`<ProductsTab>`, `<MovementsTab>`, etc.) | Mantenimiento |
| 1.2 | **Paginación server-side** — Implementar paginación con `.range()` en todas las tablas con datos crecientes | Rendimiento |
| 1.3 | **Tipado estricto** — Reemplazar `any` por tipos generados de Supabase (`Tables<"tablename">`) | Calidad |
| 1.4 | **Error Boundaries** — Añadir React Error Boundaries por módulo | Estabilidad |
| 1.5 | **Componente reutilizable MasterAccountSelector** — Extraer el selector de cuenta de Master Admin que se repite en cada módulo | DRY |
| 1.6 | **Skeleton loaders** — Reemplazar spinners genéricos por skeletons contextuales | UX |
| 1.7 | **Validación de inputs en edge functions** — Password mínimo 8 chars, formato email, sanitización | Seguridad |

### Fase 2 — UX y Diseño (Prioridad Alta)
> Objetivo: Experiencia de usuario profesional y completa

| # | Tarea | Impacto |
|---|-------|---------|
| 2.1 | **Dashboard enriquecido** — Widgets de cada módulo activo: empleados activos hoy, stock bajo, solicitudes pendientes, balance contable | UX |
| 2.2 | **Responsive tables** — Convertir tablas a cards en móvil con diseño adaptativo | UX/Móvil |
| 2.3 | **Breadcrumbs** — Navegación contextual en el header | Navegación |
| 2.4 | **Estados vacíos unificados** — Componente reutilizable `<EmptyState icon={} title="" description="" action={} />` | Consistencia |
| 2.5 | **Confirmación de eliminación unificada** — Reemplazar `confirm()` por `AlertDialog` en AppClients y donde falte | UX/Seguridad |
| 2.6 | **Filtro por rango de fechas** — Componente date range picker reutilizable para dashboard, facturas, contabilidad | Funcionalidad |
| 2.7 | **Header con perfil de usuario** — Avatar, nombre, rol visible; acceso rápido a perfil y cerrar sesión | UX |

### Fase 3 — Funcionalidades Nuevas (Prioridad Media)
> Objetivo: Funcionalidades que completan la propuesta de valor del ERP

| # | Tarea | Impacto |
|---|-------|---------|
| 3.1 | **Sistema de notificaciones** — Tabla `notifications`, campanita en header, alertas de: stock bajo, solicitudes pendientes, facturas por cobrar vencidas | Alto |
| 3.2 | **Forgot password** — Flujo completo de recuperación de contraseña por email | Alto |
| 3.3 | **Audit log** — Tabla `audit_logs` con trigger o registro manual de acciones críticas (crear/editar/eliminar) | Medio |
| 3.4 | **Informes y reportes** — Página de reportes con: P&L mensual, balance general, informe de asistencia, valoración de inventario. Exportación a PDF | Alto |
| 3.5 | **Búsqueda global** — Command palette (Cmd+K) para buscar clientes, facturas, productos, empleados | Medio |
| 3.6 | **Multi-moneda** — Soporte para facturas en diferentes monedas con tipo de cambio | Bajo |
| 3.7 | **Comentarios/notas internas** — Sistema de notas en facturas, asientos, órdenes de compra | Medio |

### Fase 4 — Integraciones y Automatización (Prioridad Baja)
> Objetivo: Automatizar procesos y conectar con servicios externos

| # | Tarea | Impacto |
|---|-------|---------|
| 4.1 | **Email automáticos** — Envío de facturas por email a clientes, recordatorios de cobro | Alto |
| 4.2 | **Facturación recurrente** — Programar facturas automáticas mensuales/trimestrales | Alto |
| 4.3 | **Integración bancaria** — Importar movimientos bancarios y conciliar con contabilidad | Alto |
| 4.4 | **API pública** — Edge functions como API REST para integraciones de terceros | Medio |
| 4.5 | **Webhooks** — Notificar a sistemas externos cuando ocurren eventos (nueva factura, stock bajo) | Medio |

### Fase 5 — Escalabilidad y Producción
> Objetivo: Preparar la app para producción real

| # | Tarea | Impacto |
|---|-------|---------|
| 5.1 | **Tests automatizados** — Tests unitarios para lógica de negocio, tests de integración para edge functions | Crítico |
| 5.2 | **Monitorización** — Logging estructurado, métricas de rendimiento | Alto |
| 5.3 | **Backup y recuperación** — Estrategia de backups de BD | Crítico |
| 5.4 | **Dominio personalizado + SSL** — Configuración de dominio propio | Producción |
| 5.5 | **Onboarding guiado** — Tour interactivo para nuevos usuarios | UX |
| 5.6 | **Documentación técnica** — README actualizado, guía de contribución, documentación de API | Mantenimiento |

---

## 🎯 Recomendación de Prioridad

**Próximos pasos inmediatos (recomendados):**
1. **Fase 1.1-1.2** — Refactor + paginación (base técnica sólida)
2. **Fase 2.1** — Dashboard enriquecido (impacto visual inmediato)
3. **Fase 2.2** — Responsive (accesibilidad móvil)
4. **Fase 3.1** — Notificaciones (engagement)
5. **Fase 3.2** — Forgot password (necesidad básica)

---

## 📊 Métricas de complejidad estimada

| Fase | Esfuerzo | Mensajes estimados |
|------|----------|-------------------|
| Fase 1 | Medio | 15-25 mensajes |
| Fase 2 | Medio | 15-20 mensajes |
| Fase 3 | Alto | 25-40 mensajes |
| Fase 4 | Alto | 30-50 mensajes |
| Fase 5 | Medio | 15-25 mensajes |
