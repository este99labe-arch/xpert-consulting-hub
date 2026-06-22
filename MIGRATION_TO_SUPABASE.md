# Guía de Migración: Lovable Cloud → Supabase (cuenta propia)

Este documento es la **instrucción operativa completa** para que Claude (o cualquier agente/dev) ejecute la migración del backend actual (Lovable Cloud, proyecto `waguxyimbqifssvxufbz`) a una nueva cuenta personal de Supabase, **sin romper ninguna funcionalidad**.

> Lee TODO el documento antes de ejecutar nada. Cada fase tiene un checkpoint de verificación. **No saltes fases.**

---

## 0. Inventario de lo que hay que migrar

| Componente | Origen | Destino |
|---|---|---|
| Esquema SQL (tablas, RLS, funciones, triggers, enums, índices) | `supabase/migrations/*.sql` (76 archivos) | Nuevo proyecto Supabase |
| Datos de todas las tablas `public.*` | DB Lovable Cloud | DB nueva |
| Usuarios de Auth (`auth.users`, identities) | Auth Lovable Cloud | Auth nuevo |
| Storage buckets: `employee-documents`, `invoice-attachments`, `import-files` (privados) | Storage Lovable | Storage nuevo |
| Edge Functions (16) — ver lista abajo | `supabase/functions/*` | Functions nuevas |
| Secrets de funciones (`RESEND_API_KEY`, `ENCRYPTION_KEY`, `WHATSAPP_*`, `LOVABLE_API_KEY`) | Secrets Lovable | Secrets nuevos |
| Cron jobs (`pg_cron` + `pg_net`) — recordatorios, recurring invoices, reminders | DB Lovable | DB nueva |
| Variables del frontend (`VITE_SUPABASE_*`) | `.env` | `.env` nuevo |

### Edge Functions a redeployar
`admin_reset_password`, `create_client_account`, `delete_client_account`, `dispatch_webhooks`, `extract_invoice_data`, `gdpr_setup_encryption`, `generate_invoice_pdf`, `generate_notifications`, `manage_api_keys`, `process_recurring_invoices`, `process_reminders`, `public_api`, `send_invoice_email`, `send_payment_reminders`, `send_welcome_email`, `whatsapp_webhook`.

---

## 1. Prerrequisitos (lado usuario)

En la nueva cuenta de Supabase:

1. Crear un proyecto nuevo. Anotar:
   - `PROJECT_REF` (subdominio, ej. `abcdxyz1234`)
   - `PROJECT_URL` = `https://<PROJECT_REF>.supabase.co`
   - `ANON_KEY` (Settings → API → `anon public`)
   - `SERVICE_ROLE_KEY` (Settings → API → `service_role secret`) — **NUNCA al cliente**
   - `DB_PASSWORD` (la que pusiste al crear el proyecto)
   - Connection string: Settings → Database → `Connection string` → URI
2. Instalar el Supabase CLI local (`npm i -g supabase` o `brew install supabase/tap/supabase`).
3. Instalar `psql` y `pg_dump` ≥ 15.
4. Acceso temporal a la DB Lovable Cloud para `pg_dump` — solicitar a soporte Lovable la cadena `postgres://...` de **solo lectura** del proyecto `waguxyimbqifssvxufbz`. **Lovable Cloud no expone `SERVICE_ROLE_KEY` ni la password de DB al usuario final**, por lo que esto debe pasar por soporte.

> Si soporte no te facilita acceso directo, salta a la **Variante B** al final del documento: migración basada únicamente en las migraciones del repo + export CSV de tablas.

---

## 2. Fase 1 — Esquema

Las 76 migraciones en `supabase/migrations/` reproducen el esquema completo (tablas, RLS, funciones, triggers, GRANTs, índices, enums, extensiones `pgcrypto`/`pg_cron`/`pg_net`).

```bash
# Desde la raíz del repo
supabase link --project-ref <NUEVO_PROJECT_REF>
# Te pedirá la DB password — usa la del nuevo proyecto

# Aplicar TODAS las migraciones en orden cronológico
supabase db push
```

### Checkpoint 1
```sql
-- conectado al nuevo proyecto
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
-- debe devolver ≈ 49 tablas (ver <supabase-tables> de referencia)
SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
-- debe coincidir con las funciones listadas en <db-functions>
```

Si falla alguna migración por orden, revisar dependencias y reaplicar la migración específica con `psql`.

---

## 3. Fase 2 — Auth users

Lovable Cloud usa el mismo schema `auth` de Supabase. Migración:

```bash
# 1. Volcar SOLO el schema auth de origen (datos)
pg_dump "$LOVABLE_DB_URL" \
  --schema=auth \
  --data-only \
  --no-owner --no-acl \
  --table=auth.users \
  --table=auth.identities \
  --table=auth.mfa_factors \
  --table=auth.mfa_amr_claims \
  --table=auth.mfa_challenges \
  > /tmp/auth_data.sql

# 2. Restaurar en el destino
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/auth_data.sql
```

> Los password hashes (`bcrypt`) son portables entre instancias Supabase — los usuarios podrán iniciar sesión con sus credenciales actuales sin reset.

### Checkpoint 2
```sql
SELECT count(*) FROM auth.users;          -- debe coincidir con el origen
SELECT count(*) FROM public.user_accounts; -- debe coincidir (FK a auth.users)
```

---

## 4. Fase 3 — Datos de `public`

```bash
pg_dump "$LOVABLE_DB_URL" \
  --schema=public \
  --data-only \
  --no-owner --no-acl \
  --disable-triggers \
  > /tmp/public_data.sql

psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = 'replica';" \
  -f /tmp/public_data.sql \
  -c "SET session_replication_role = 'origin';"
```

`--disable-triggers` + `session_replication_role=replica` evita que se redisparen los triggers de cifrado/auditoría/auto-journal durante el restore (los datos ya vienen cifrados desde origen).

### ⚠️ Cifrado AES-256

La función `_get_encryption_key()` está cableada con la `ENCRYPTION_KEY`. Para que los datos cifrados (`*_enc` en `business_clients`, `client_contacts`, `employee_profiles`, `accounts`) sigan siendo legibles en el destino:

1. Recuperar el valor actual de `ENCRYPTION_KEY` (se pidió al usuario; no es recuperable desde Lovable). Si no se conserva → re-cifrado requerido (ver más abajo).
2. En el nuevo proyecto, añadir `ENCRYPTION_KEY` como secret de Edge Functions con el **mismo valor**.
3. Invocar la edge function `gdpr_setup_encryption` una vez en destino — instala la clave dentro de `_get_encryption_key()` vía `_install_encryption_key`.

Si la clave se ha perdido: tras restaurar los datos, llamar al RPC `reencrypt_all_with_key('clave_vieja','clave_nueva')` con la pareja correcta. Sin la clave vieja, los datos cifrados son irrecuperables.

### Checkpoint 3
```sql
SELECT count(*) FROM public.accounts;
SELECT count(*) FROM public.invoices;
SELECT count(*) FROM public.business_clients;
-- Verificar descifrado:
SELECT public._decrypt_text(tax_id_enc) FROM public.business_clients LIMIT 3;
```

### Resecuenciar IDs seriales (si aplica)
```sql
-- Para cada secuencia, ajustar al MAX(id)+1 — el script siguiente lo genera automáticamente:
SELECT 'SELECT setval(' || quote_literal(quote_ident(sequence_schema)||'.'||quote_ident(sequence_name))
       || ', (SELECT COALESCE(MAX(id),1) FROM ' || table_name || '));'
FROM information_schema.sequences WHERE sequence_schema='public';
```

---

## 5. Fase 4 — Storage buckets

```bash
# Crear buckets en destino (todos privados)
for b in employee-documents invoice-attachments import-files; do
  curl -X POST "$NEW_PROJECT_URL/storage/v1/bucket" \
    -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$b\",\"name\":\"$b\",\"public\":false}"
done
```

Para mover los archivos: usar el script Node que está al final (sección **Anexo A**) o `rclone` con backend S3 (Supabase Storage expone API compatible vía `Settings → Storage`).

Volver a aplicar las policies de storage — están dentro de las migraciones de `supabase/migrations/`, ya quedaron aplicadas en la Fase 1.

### Checkpoint 4
Subir/descargar un archivo de prueba desde la app autenticada y verificar que las RLS de cada bucket funcionan.

---

## 6. Fase 5 — Edge Functions

```bash
# Desde la raíz del repo, con el proyecto ya linkeado al NUEVO ref
supabase functions deploy admin_reset_password
supabase functions deploy create_client_account
supabase functions deploy delete_client_account
supabase functions deploy dispatch_webhooks
supabase functions deploy extract_invoice_data
supabase functions deploy gdpr_setup_encryption
supabase functions deploy generate_invoice_pdf
supabase functions deploy generate_notifications
supabase functions deploy manage_api_keys
supabase functions deploy process_recurring_invoices
supabase functions deploy process_reminders
supabase functions deploy public_api
supabase functions deploy send_invoice_email
supabase functions deploy send_payment_reminders
supabase functions deploy send_welcome_email
supabase functions deploy whatsapp_webhook
```

`supabase/config.toml` ya declara `verify_jwt = false` para las funciones que lo necesitan; Supabase CLI lo respeta.

### Secrets

```bash
supabase secrets set \
  RESEND_API_KEY="re_xxx" \
  ENCRYPTION_KEY="<misma_clave_que_lovable>" \
  WHATSAPP_ACCESS_TOKEN="..." \
  WHATSAPP_APP_SECRET="..." \
  LOVABLE_API_KEY="..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` se inyectan automáticamente por Supabase — no añadirlas a mano.

### Checkpoint 5
```bash
curl "$NEW_PROJECT_URL/functions/v1/process_reminders" \
  -H "Authorization: Bearer $NEW_ANON_KEY"
# debe responder { success: true, notifications_created: N }
```

---

## 7. Fase 6 — Cron jobs (`pg_cron` + `pg_net`)

Los cron jobs no viajan con `pg_dump` automáticamente. Recrearlos en destino:

```sql
-- Asegurar extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Procesar recordatorios cada minuto
SELECT cron.schedule(
  'process-reminders',
  '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://<NUEVO_PROJECT_REF>.supabase.co/functions/v1/process_reminders',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<NEW_ANON_KEY>'),
    body := '{}'::jsonb
  ); $$
);

-- 2. Facturas recurrentes (diario 06:00)
SELECT cron.schedule(
  'process-recurring-invoices',
  '0 6 * * *',
  $$ SELECT net.http_post(
    url := 'https://<NUEVO_PROJECT_REF>.supabase.co/functions/v1/process_recurring_invoices',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<NEW_ANON_KEY>'),
    body := '{}'::jsonb
  ); $$
);

-- 3. Recordatorios de pago (diario 09:00)
SELECT cron.schedule(
  'send-payment-reminders',
  '0 9 * * *',
  $$ SELECT net.http_post(
    url := 'https://<NUEVO_PROJECT_REF>.supabase.co/functions/v1/send_payment_reminders',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<NEW_ANON_KEY>'),
    body := '{}'::jsonb
  ); $$
);

-- 4. Generar notificaciones (cada 15 min)
SELECT cron.schedule(
  'generate-notifications',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://<NUEVO_PROJECT_REF>.supabase.co/functions/v1/generate_notifications',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<NEW_ANON_KEY>'),
    body := '{}'::jsonb
  ); $$
);
```

> Antes de ejecutar, **listar los cron jobs actuales** del origen con `SELECT * FROM cron.job;` y replicarlos exactamente — la lista de arriba es la esperada según el código.

### Checkpoint 6
```sql
SELECT jobname, schedule, active FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## 8. Fase 7 — Auth providers

Replicar manualmente en el dashboard del nuevo proyecto (Authentication → Providers):

- **Email/password** activado.
- **Google OAuth** — copiar `Client ID` / `Client Secret` desde Google Cloud Console (los mismos del origen). En "Authorized redirect URIs" añadir `https://<NUEVO_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Site URL: `https://xpert-biz-suite.lovable.app` (o tu dominio publicado).
- Redirect URLs autorizadas: añadir el dominio publicado, el preview y `http://localhost:8080`.

---

## 9. Fase 8 — Frontend (swap del cliente)

Actualizar `.env` del proyecto:

```env
VITE_SUPABASE_PROJECT_ID="<NUEVO_PROJECT_REF>"
VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
VITE_SUPABASE_URL="https://<NUEVO_PROJECT_REF>.supabase.co"
```

`src/integrations/supabase/client.ts` lee de `import.meta.env.*` (verificar): si está hardcodeado el URL antiguo, sustituirlo. **No regenerar `types.ts` desde el origen tras la migración**; regenerarlo desde el destino con:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Checkpoint final
1. `npm run dev` y probar login con un usuario migrado.
2. Listar facturas, abrir un cliente, ver descifrado de NIF/teléfono.
3. Crear una factura nueva → verificar que el trigger `auto_journal_entry_from_invoice` crea el asiento.
4. Subir un documento a `employee-documents`.
5. Lanzar manualmente `process_reminders` y verificar notificaciones.
6. Revisar `pg_cron.job_run_details` tras 5 minutos.

---

## 10. Rollback

Si algo falla, **no se ha tocado nada del origen**: basta con revertir `.env` al `VITE_SUPABASE_*` original y la app vuelve a apuntar a Lovable Cloud. Mantener Lovable Cloud activo durante 1-2 semanas como red de seguridad antes de cancelar.

---

## Variante B — Sin acceso a la DB de Lovable Cloud

Si soporte no facilita la cadena de conexión Postgres:

1. Fase 1 (esquema) igual: `supabase db push` aplica las migraciones.
2. Para datos: desde la app Lovable, exportar cada tabla a CSV (Cloud → Database → export por tabla) e importarlas en orden de dependencias (`roles`, `accounts`, `user_accounts`, luego el resto) con `\copy` en `psql`.
3. Auth: no portable sin acceso DB → todos los usuarios necesitarán **password reset**. Disparar `auth.admin.generateLink({ type: 'recovery', email })` por cada usuario vía script de servicio.
4. Storage: descargar archivos desde la UI o vía cliente autenticado y resubirlos al nuevo bucket con el script del Anexo A.

---

## Anexo A — Script de migración de Storage

`scripts/migrate-storage.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const SRC = createClient(process.env.SRC_URL!, process.env.SRC_SERVICE_KEY!);
const DST = createClient(process.env.DST_URL!, process.env.DST_SERVICE_KEY!);
const BUCKETS = ["employee-documents", "invoice-attachments", "import-files"];

for (const bucket of BUCKETS) {
  const walk = async (prefix = "") => {
    const { data, error } = await SRC.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) { await walk(path); continue; }       // carpeta
      const { data: blob } = await SRC.storage.from(bucket).download(path);
      if (!blob) continue;
      await DST.storage.from(bucket).upload(path, blob, {
        contentType: item.metadata?.mimetype, upsert: true,
      });
      console.log(`✓ ${bucket}/${path}`);
    }
  };
  await walk();
}
```

Ejecutar: `bun scripts/migrate-storage.ts`.

---

## Anexo B — Orden de ejecución resumido (para Claude)

```text
1. supabase link --project-ref <NEW>
2. supabase db push                               # Fase 1
3. pg_dump auth + psql restore                    # Fase 2
4. pg_dump public --data-only + psql restore      # Fase 3
5. resequence + setval                            # Fase 3.5
6. crear buckets + bun scripts/migrate-storage.ts # Fase 4
7. supabase secrets set ...                       # Fase 5a
8. supabase functions deploy <cada una>           # Fase 5b
9. SQL cron.schedule(...)                         # Fase 6
10. configurar Google OAuth en dashboard          # Fase 7
11. actualizar .env del repo + gen types          # Fase 8
12. smoke tests del checkpoint final              # Fase 8.5
```

Cuando el usuario diga **"ejecuta la migración"**, recorre estos pasos en orden, parando en cada Checkpoint para confirmar resultado antes de continuar.
