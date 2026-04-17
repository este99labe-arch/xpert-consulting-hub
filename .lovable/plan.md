

El usuario confirma el plan pero matiza la parte del sidebar: el filtrado por rol no debe ser una whitelist hardcodeada. Debe respetar dos niveles de activación:

1. **ADMIN → Cuenta cliente**: ya existe vía `account_modules` (tabla con `account_id` + `module_id` + `is_enabled`). Lo gestiona el `ModuleManager` desde MasterClients. Esto sigue igual.
2. **MANAGER → Empleados de su cuenta**: NO existe hoy. Hay que añadirlo. El MANAGER decide qué módulos (de los activados por ADMIN para su cuenta) puede ver cada empleado.

Esto implica una nueva tabla `user_modules` (asignación por usuario) y una pestaña nueva en Configuración para que el MANAGER gestione los permisos de módulo de cada empleado.

## Ajuste al plan original

Sustituyo la sección **"4. Sidebar adaptativo por rol"** por esta versión jerárquica de 3 niveles:

### 4. Sidebar adaptativo en cascada (3 niveles)

La visibilidad de cada módulo se calcula como:

```text
módulo visible para usuario =
  está habilitado en account_modules (decisión ADMIN)
  AND
  (rol = MANAGER/MASTER_ADMIN  →  visible siempre)
  OR
  (rol = EMPLOYEE  →  asignado en user_modules para ese usuario)
```

Es decir:
- **ADMIN** decide qué módulos tiene la cuenta cliente (ya existe, no se toca).
- **MANAGER** ve siempre todos los módulos activos de su cuenta (no necesita asignación individual).
- **EMPLOYEE** solo ve los módulos que su MANAGER le haya asignado explícitamente desde Configuración.

### Cambios técnicos añadidos

**Backend (migración SQL)**:
- Nueva tabla `user_modules`:
  - `id uuid PK`, `account_id uuid`, `user_id uuid`, `module_id uuid`, `is_enabled boolean default true`, `created_at timestamptz`
  - Unique `(user_id, module_id)`
  - RLS:
    - MANAGER/MASTER_ADMIN de la cuenta: `ALL` sobre filas de su `account_id`.
    - Usuario: `SELECT` sobre `user_id = auth.uid()`.
- Módulos siempre visibles para EMPLOYEE sin asignación (Dashboard, Asistencia, Tareas, Configuración) → no se filtran por `user_modules`; se consideran "core".
- Trigger opcional: al crear un nuevo empleado, copiar automáticamente los módulos por defecto que el MANAGER haya marcado (fase 2; no bloqueante).

**Frontend**:
- `src/layouts/ClientLayout.tsx` → la query de módulos activos se cruza con `user_modules` cuando `role === "EMPLOYEE"`. MANAGER y MASTER_ADMIN siguen viendo todos los módulos activos de la cuenta.
- `src/pages/app/AppSettings.tsx` → nueva pestaña **"Permisos de empleados"** (solo MANAGER) que lista los empleados de la cuenta y, por cada uno, muestra los módulos activos de la cuenta con un Switch para activar/desactivar acceso. Reutiliza el patrón de `ModuleManager`.
- `src/components/ProtectedRoute.tsx` → añadir guard que para EMPLOYEE comprueba si la ruta destino corresponde a un módulo asignado; si no, redirige a `/app/dashboard`. Las rutas core (dashboard, asistencia, tareas, settings) siempre permitidas.

### Resumen del flujo completo

```text
[ADMIN]  Master > Clientes > [Empresa] > Módulos
   │  activa: Facturación, RRHH, Inventario, ...
   ▼
account_modules (account_id, module_id, is_enabled=true)
   │
[MANAGER de esa empresa]  App > Configuración > Permisos
   │  para Juan (EMPLOYEE): ✓ Asistencia, ✓ Tareas, ✗ Facturación
   ▼
user_modules (user_id=Juan, module_id, is_enabled=true)
   │
[Juan EMPLOYEE]  ve en sidebar:
   - Dashboard (core)
   - Asistencia (core)
   - Tareas (core)
   - Configuración (core)
   - (NO ve Facturación porque su manager no se la asignó)
```

## Archivos afectados (actualizado)

Se mantienen todos los del plan original, más:

- `supabase/migrations/<nuevo>.sql` — tabla `user_modules` + RLS.
- `src/pages/app/AppSettings.tsx` — nueva pestaña "Permisos de empleados" (solo MANAGER).
- `src/components/settings/EmployeeModulesTab.tsx` — **nuevo**, gestor de módulos por empleado.
- `src/layouts/ClientLayout.tsx` — cruce con `user_modules` para EMPLOYEE.
- `src/components/ProtectedRoute.tsx` — guard de ruta basado en módulos asignados.

El resto del plan (dashboards diferenciados por rol Admin/Manager/Employee con sus widgets) queda igual.

## Cómo probarlo (actualizado)

1. **ADMIN**: en Master > Clientes activa Facturación + RRHH + Inventario para la cuenta de prueba.
2. **MANAGER** de esa cuenta: en App > Configuración > Permisos crea un empleado y le asigna solo Asistencia y Tareas.
3. **EMPLOYEE** (ese usuario): el sidebar muestra solo Dashboard + Asistencia + Tareas + Configuración. Acceder a `/app/invoices` redirige al dashboard. Su Dashboard es la versión personal (jornada, vacaciones, tareas).
4. El MANAGER, en cambio, sigue viendo los 3 módulos activos de la cuenta sin necesidad de auto-asignación.

