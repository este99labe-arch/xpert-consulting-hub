

## Plan: Rediseño completo de la pestaña Configuracion

### Contexto
La pestaña actual tiene 3 tabs (Empresa, Horario, Usuarios). Se necesita una configuracion mas completa con perfil de usuario, gestion de contraseñas diferenciada por rol, y flujo de aprobacion para cambios de perfil.

### Cambios

#### 1. Sidebar: SETTINGS siempre al final
En `ClientLayout.tsx`, separar el modulo SETTINGS del listado dinamico y renderizarlo siempre al final (despues de todos los demas modulos), de forma fija.

#### 2. Nueva tabla: `profile_change_requests`
Para el flujo de aprobacion de cambios de perfil por parte del manager.

```sql
CREATE TABLE public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
-- RLS policies for employees to insert own requests, managers to manage account requests
```

#### 3. Edge Function: nuevas acciones en `admin_reset_password`
- **`change_own_password`**: Para empleados. Recibe `current_password` y `new_password`. Verifica la contraseña actual usando `signInWithPassword` antes de cambiarla.
- **`force_reset_password`**: Para managers. Genera o recibe nueva contraseña para un usuario, la actualiza via admin API, y llama a `send_welcome_email` para notificar por correo al usuario afectado.

#### 4. Rediseño de `AppSettings.tsx` con 5 tabs

| Tab | Visible para | Contenido |
|---|---|---|
| **Empresa** | Todos | Info de la empresa (nombre, estado, fecha creacion). Solo lectura para empleados. Managers pueden editar campos adicionales. |
| **Mi Perfil** | Todos | Datos del `employee_profiles` del usuario actual (nombre, DNI, telefono, direccion, etc). Empleados pueden proponer cambios que generan una `profile_change_request`. Managers editan directamente. |
| **Horario** | Todos | Configuracion existente de horario laboral y vacaciones. Solo editable por managers. |
| **Seguridad** | Todos | Cambio de contraseña propia. Empleados: deben introducir contraseña actual + nueva. Managers: pueden cambiar su propia contraseña igual, Y ademas tienen un panel para forzar reset de cualquier empleado (con envio de email). |
| **Usuarios** | Solo Manager | Gestion de usuarios existente (listado, crear, desactivar). |

#### 5. Flujo de aprobacion de perfil (Manager)
En la tab "Mi Perfil" o en "Usuarios", los managers veran un badge/contador con solicitudes pendientes. Al aprobar, se actualiza el `employee_profiles` y el status del request.

### Detalles tecnicos
- La verificacion de contraseña actual del empleado se hace server-side en la edge function usando `signInWithPassword` con las credenciales proporcionadas
- El force reset del manager invoca `send_welcome_email` con la nueva contraseña generada
- Las `profile_change_requests` usan RLS: empleados INSERT own + SELECT own; managers ALL para su account

### Archivos afectados
- `src/layouts/ClientLayout.tsx` -- reordenar SETTINGS al final
- `src/pages/app/AppSettings.tsx` -- reescritura completa
- `supabase/functions/admin_reset_password/index.ts` -- nuevas acciones
- Migration SQL -- nueva tabla `profile_change_requests`

