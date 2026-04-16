

## Problema

Dos bloqueos en cadena impiden que XpertRed funcione, sin importar lo que se toque en el frontend:

1. **Descubrir devuelve siempre vacío** porque la consulta hace un `inner join` a la tabla `accounts` para traer el nombre de la empresa, pero las políticas de seguridad de `accounts` solo permiten ver tu propia cuenta. Resultado: el join elimina todas las filas y no aparece ninguna empresa (los logs de red lo confirman: respuesta `[]`).
2. **Aceptar solicitudes nunca guarda nada** porque la tabla `xred_interactions` solo permite los tipos `like`, `skip`, `block`. El frontend intenta insertar `type='accept'`, la BD lo rechaza silenciosamente y el match nunca se marca. Por eso Volarte nunca veía la solicitud y XpertConsulting nunca veía la conexión.

A esto se suma que las pestañas “Solicitudes”, “Enviadas”, “Conexiones” y “Mi Red” también dependían de leer nombres desde `accounts`, así que aunque hubiera datos no se mostrarían correctamente.

## Solución

Una corrección integral en dos frentes (BD + frontend) para que el flujo Descubrir → Solicitud → Aceptación → Conexión + Chat funcione de extremo a extremo.

### 1. Backend (migración SQL)

- **Vista pública `xred_directory`** (security_invoker off) que une `xred_profiles` visibles con el nombre de la cuenta. Permite a cualquier usuario autenticado ver `account_id` + `name` + datos del perfil sin tocar la RLS de `accounts`. Política: `SELECT` para `authenticated`.
- **Ampliar el CHECK** de `xred_interactions.type` para aceptar también `accept` y `reject`.
- **Trigger `xred_check_match` definitivo**:
  - `like` → crea solicitud pendiente (`is_match=false`).
  - `accept` → marca `is_match=true` en la fila nueva y en el `like` recíproco.
  - `reject` / `skip` / `block` → `is_match=false`.
- **Función RPC `xred_resolve_names(_ids uuid[])`** (security definer) que devuelve `id, name, email, phone` desde `accounts` solo si el usuario participa en una interacción con esa cuenta. Se usa en Matches y Mi Red sin exponer el directorio entero.
- **Limpieza de la interacción rota** XpertConsulting → Volarte para poder probar el flujo limpio.

### 2. Frontend

**`DiscoverTab.tsx`**
- Reemplazar la consulta a `xred_profiles + accounts!inner` por una consulta a la nueva vista `xred_directory`.
- Excluir la cuenta actual y las cuentas con las que ya hay un match (no las que tienen solicitud pendiente — esas se mantienen, según tu preferencia).
- Mantener los filtros (nombre, sector, CNAE, ubicación) y el score.

**`MatchesTab.tsx`**
- Sustituir todos los `from("accounts").select("id,name")` por la RPC `xred_resolve_names`.
- Tres sub-pestañas con datos reales:
  - **Conexiones**: lista de matches + panel de chat. Cabecera del chat con email y teléfono de contacto de la otra empresa.
  - **Solicitudes recibidas**: likes que apuntan a mí sin respuesta. Botones Aceptar (`type='accept'`) / Rechazar (`type='reject'`).
  - **Solicitudes enviadas**: mis likes pendientes con badge “Pendiente”.
- Realtime ya configurado, se mantiene.

**`NetworkTab.tsx`**
- Misma sustitución de nombres vía RPC, para que las conexiones se vean.

### 3. Flujo final esperado

```text
[XpertConsulting]                    [Volarte]
   Descubrir
  (ve Volarte) ─── Conectar ──▶ xred_interactions (like, pendiente)
                                       │
                                       ▼
                              Matches > Solicitudes
                              [Aceptar] / [Rechazar]
                                       │
                                       ▼
                              accept → is_match=true (ambos lados)
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
   Matches > Conexiones                         Matches > Conexiones
   (ve Volarte + email/tel + chat)              (ve XpertConsulting + email/tel + chat)
```

## Archivos afectados

- `supabase/migrations/<nuevo>.sql` — vista `xred_directory`, CHECK ampliado, trigger actualizado, RPC `xred_resolve_names`, limpieza de la interacción de prueba.
- `src/components/xpertred/DiscoverTab.tsx` — consulta sobre la vista, exclusión de matches.
- `src/components/xpertred/MatchesTab.tsx` — RPC de nombres + email/teléfono en cabecera del chat.
- `src/components/xpertred/NetworkTab.tsx` — RPC de nombres.

## Cómo probarlo

1. **XpertConsulting**: Descubrir → debes ver Volarte → “Conectar”. La tarjeta sigue ahí (según tu preferencia) y aparece en Matches > Enviadas.
2. **Volarte**: Matches > Solicitudes → ves XpertConsulting → “Aceptar”.
3. **Ambos**: Matches > Conexiones → la otra empresa aparece con email + teléfono y chat funcional en tiempo real.

