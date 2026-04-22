

# Plan: Cumplimiento RGPD/GDPR para XpertConsulting

Vamos a abordar el cumplimiento RGPD en **dos capas**: (1) cifrado de datos sensibles a nivel de columna en la base de datos usando **pgsodium / pgcrypto AES-256**, y (2) los componentes legales/operativos imprescindibles que actualmente faltan (consentimiento de cookies, política de privacidad, derecho al acceso/portabilidad/olvido, registro de consentimientos y DPA).

---

## 1. Cifrado AES-256 de datos sensibles (núcleo de tu petición)

### Enfoque técnico

PostgreSQL en Supabase incluye la extensión **`pgcrypto`** (AES-256 nativo). Vamos a usar el patrón estándar de Supabase: **columnas cifradas + vista descifrada + función `SECURITY DEFINER`** que aplica RLS antes de descifrar. Así:

- En la tabla, los datos sensibles se almacenan en columnas `bytea` cifradas (`pgp_sym_encrypt(...)` con AES-256).
- Una **clave maestra** se guarda como secret de Supabase (`ENCRYPTION_KEY`) y se inyecta vía configuración de DB (`app.encryption_key`), nunca en código cliente.
- Triggers `BEFORE INSERT/UPDATE` cifran automáticamente cuando llega texto plano desde el cliente.
- Una función `decrypt_field(account_id, field_name, ciphertext)` valida que el usuario tenga acceso al `account_id` antes de devolver el valor en claro.
- En cliente, en lugar de leer la columna directamente, se llama a un RPC `get_decrypted_client(id)` que devuelve el registro con campos sensibles ya descifrados (solo si RLS lo permite).

### Campos a cifrar (clasificación)

| Tabla | Campos cifrados |
|---|---|
| `business_clients` | `tax_id`, `email`, `phone`, `address`, `billing_address` |
| `client_contacts` | `email`, `phone` |
| `employee_profiles` | `dni`, `social_security_number`, `phone`, `address`, `date_of_birth` |
| `accounts` | `tax_id`, `phone`, `address` |

(Los nombres comerciales, ciudades genéricas y datos no-PII permanecen en claro para que la búsqueda y los índices sigan funcionando.)

### Migración por pasos (sin romper datos existentes)

1. Crear extensión `pgcrypto` y guardar `ENCRYPTION_KEY` como secret.
2. Añadir columnas `<campo>_enc bytea` junto a las actuales.
3. Migración one-shot que cifra los valores existentes y los copia a las nuevas columnas.
4. Crear triggers de cifrado/descifrado y RPCs `get_decrypted_*`.
5. Adaptar el frontend (ver sección 4) para leer vía RPC y escribir texto plano (el trigger cifra).
6. Una vez verificado, **dropear** las columnas en claro.

### Búsqueda sobre campos cifrados

Para mantener búsqueda por NIF/email sin descifrar todo, añadimos columnas **hash determinista** (`tax_id_hash text` con `digest(lower(value), 'sha256')`) indexadas. La búsqueda se hace por hash exacto; las búsquedas parciales (`ilike`) sobre campos cifrados se desactivan y se reemplazan por búsqueda por nombre (no sensible) o NIF exacto.

---

## 2. Cookies y consentimiento

- Banner de cookies (componente `CookieConsent`) con opciones: **Aceptar todas / Rechazar / Personalizar** (técnicas, analíticas, marketing).
- Tabla `user_consents` (user_id, tipo, granted, version_politica, ip_hash, timestamp) para registrar prueba de consentimiento conforme al art. 7 RGPD.
- Página `/legal/cookies` con detalle de cada cookie usada.

---

## 3. Páginas legales y derechos del usuario

- `/legal/privacy` — Política de Privacidad (plantilla RGPD adaptada a XpertConsulting con tu rol de Encargado de Tratamiento).
- `/legal/terms` — Términos de uso.
- `/legal/dpa` — Acuerdo de Encargado de Tratamiento descargable PDF.
- En `/app/settings` nueva pestaña **"Privacidad y Datos"** con:
  - **Exportar mis datos** (derecho de portabilidad, art. 20) — descarga ZIP con JSON de todas las tablas asociadas al usuario, vía edge function `export_user_data`.
  - **Solicitar eliminación de cuenta** (derecho al olvido, art. 17) — crea registro en nueva tabla `data_deletion_requests`, notifica a MASTER_ADMIN, ejecuta tras 30 días.
  - **Ver consentimientos otorgados** y revocarlos.
  - **Historial de accesos a mis datos** (lee `audit_logs` filtrado por el `user_id`).

---

## 4. Cambios en frontend (impacto en el código existente)

- `ClientInfoTab.tsx`, `CreateBusinessClientDialog.tsx`, `AppClients.tsx`: lectura via RPC `get_decrypted_business_client(id)` / `list_business_clients_decrypted()`. Escritura sin cambios (el trigger cifra).
- `EmployeesTab.tsx`, `CreateEmployeeDialog.tsx`, `AppSettings → ProfileTab`: idem con `employee_profiles`.
- `client_contacts` en `ClientContactsTab.tsx`: idem.
- Búsqueda por NIF: cambia de `.ilike("tax_id", ...)` a `.eq("tax_id_hash", sha256(input))`.
- El patrón de **field locking** (NIF/DNI bloqueados por defecto) ya existente se mantiene como capa UX adicional.

---

## 5. Estructura de archivos nuevos

```text
src/
├── components/
│   ├── legal/
│   │   ├── CookieConsent.tsx
│   │   └── PrivacySettingsTab.tsx
├── pages/legal/
│   ├── PrivacyPolicy.tsx
│   ├── CookiePolicy.tsx
│   ├── TermsOfService.tsx
│   └── DPA.tsx
├── lib/
│   ├── encryption.ts        (helpers para hash de búsqueda en cliente)
│   └── consent.ts           (gestión del banner)
supabase/
├── functions/
│   ├── export_user_data/    (descarga ZIP de datos)
│   └── process_deletion_request/
└── migrations/
    ├── XXXX_enable_pgcrypto_and_key.sql
    ├── XXXX_encrypt_business_clients.sql
    ├── XXXX_encrypt_employee_profiles.sql
    ├── XXXX_encrypt_client_contacts.sql
    ├── XXXX_user_consents_table.sql
    └── XXXX_data_deletion_requests.sql
```

---

## 6. Notas de seguridad importantes

- La `ENCRYPTION_KEY` se almacenará como **secret de Supabase** y se cargará vía `ALTER DATABASE SET app.encryption_key`. **Una vez fijada, no debe cambiarse sin un script de re-cifrado** (lo dejamos documentado).
- El cifrado a nivel de columna **no sustituye RLS**; trabajan en capas. Si un atacante consigue acceso de solo-lectura a la DB sin la clave, los campos sensibles aparecen como bytes ilegibles.
- Los **PDFs de facturas y los CSV exportados** seguirán mostrando el NIF en claro (necesario funcionalmente). Esto es compatible con RGPD si el acceso al PDF está autenticado (ya lo está).
- Backups de Supabase: están cifrados en reposo por defecto a nivel de plataforma.

---

## 7. Plan de ejecución (orden de fases)

1. **Fase 1 — Cifrado**: extensión + clave + columnas cifradas + triggers + RPCs en `business_clients`, `client_contacts`, `employee_profiles`, `accounts`. Migración de datos existentes. Adaptación de los componentes que los leen.
2. **Fase 2 — Consentimiento**: banner de cookies + tabla `user_consents` + página de política de cookies.
3. **Fase 3 — Páginas legales**: privacy, terms, DPA, cookies (texto plantilla que tú podrás editar).
4. **Fase 4 — Derechos del usuario**: pestaña "Privacidad y Datos" + edge functions de exportación y eliminación.

¿Quieres que ejecutemos las **4 fases completas** o prefieres empezar solo por la **Fase 1 (cifrado AES-256)** que es lo que has pedido explícitamente, y luego decidimos sobre las demás?

