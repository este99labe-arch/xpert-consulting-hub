# Auditoría de producto — XpertConsulting ERP

**Fecha:** julio 2026 · **Alcance:** aplicación completa (frontend, backend, BD, seguridad, UX, producto)
**Criterio:** "¿Está lista para venderse a empresas que pagan cientos/miles de €/mes?"

**Metodología:** análisis del esquema real de la base de datos, linter de seguridad y rendimiento de Supabase (advisors), escaneo estático del frontend (31.400 líneas en `src/`) y revisión funcional módulo a módulo.

**Niveles:** 🔴 **P0** crítico (bloquea producción) · 🟠 **P1** alto (profesionalización) · 🟡 **P2** medio (pulido) · 🔵 **P3** roadmap.

---

## Resumen ejecutivo

| # | Área | Hallazgo principal | Nivel |
|---|------|--------------------|-------|
| 1 | Seguridad BD | 33 funciones `SECURITY DEFINER` ejecutables vía REST por cualquier usuario (motor contable manipulable entre cuentas) | 🔴 P0 |
| 2 | Seguridad Auth | Protección de contraseñas filtradas (HaveIBeenPwned) desactivada | 🔴 P0 |
| 3 | Seguridad | `whatsapp_config.access_token` (credencial Meta) en texto plano, legible desde el cliente | 🔴 P0 |
| 4 | Rendimiento BD | 155 políticas RLS re-evalúan `auth.uid()` por fila; 105 políticas permisivas duplicadas; 51 FKs sin índice | 🟠 P1 |
| 5 | Modelo: cuentas | Faltan razón social, país, zona horaria, idioma, plan, persona de contacto, datos de facturación | 🟠 P1 |
| 6 | Modelo: empleados | Faltan baja, tipo de contrato, jornada, responsable, centro, salario, email corporativo, estado | 🟠 P1 |
| 7 | Horarios | Un único horario por empresa; sin plantillas ni horarios por empleado | 🟠 P1 |
| 8 | Facturación | Sin fecha de vencimiento real (`due_date`): "vencida" = heurística de 30 días | 🟠 P1 |
| 9 | UX consistencia | Estados de carga/vacío desiguales (2 usos de Skeleton en toda la app), formateador € duplicado en 14 ficheros | 🟠 P1 |
| 10 | Código | `AppSettings.tsx` 1.099 líneas; 136 `as any` (tipos de Supabase desactualizados) | 🟡 P2 |
| 11 | Producto | Faltan: calendario de festivos, export para gestorías, 2FA, portal de cliente final | 🔵 P1–P3 |

---

## 1. Seguridad — 🔴 P0

### 1.1 Funciones `SECURITY DEFINER` expuestas por REST *(✅ corregido en esta auditoría)*
El linter detecta 33 avisos: funciones internas ejecutables vía `/rest/v1/rpc/...` por `anon` y `authenticated`. Las graves:

- **`_acc_post_accrual` / `_acc_post_collection`**: cualquier usuario autenticado de *cualquier* cuenta podía invocar el motor contable sobre facturas de *otra* cuenta (regenerar/insertar asientos cruzando tenants).
- **Funciones de trigger** (`auto_journal_entry_from_payment`, `notify_chat_task_completed`, `rls_auto_enable`…): jamás deben ser invocables por clientes.

**Acción aplicada:** migración `security_hardening_audit` — `REVOKE EXECUTE` a `PUBLIC/anon/authenticated` sobre todas las funciones internas del motor y de trigger. Se mantienen ejecutables las RPC legítimas del frontend (`get_decrypted_*`, `list_*_decrypted`, `invoice_kpis`, `log_audit_event`, `has_role`, `get_user_account_id` — estas dos últimas las necesitan las políticas RLS).

**Pendiente (menor):** `get_user_account_id(uuid)` permite a un autenticado mapear cualquier `user_id → account_id`. Valorar versión sin parámetro (`auth.uid()` implícito).

### 1.2 Protección de contraseñas filtradas desactivada
Supabase Auth puede rechazar contraseñas comprometidas (HaveIBeenPwned) y está **apagado**.
**Acción:** activar en *Dashboard → Authentication → Providers → Password* (no es configurable por SQL). Añadir además política de complejidad mínima.

### 1.3 Token de Meta en texto plano
`whatsapp_config.access_token` se guarda sin cifrar y la RLS permite a los managers leerlo con un `select *`. El proyecto ya tiene infraestructura de cifrado (`_encrypt_text`/`_decrypt_text` con `ENCRYPTION_KEY`).
**Propuesta:** columna `access_token_enc bytea` + trigger de cifrado (mismo patrón que `tax_id_enc`), y que el frontend nunca lo re-lea (solo escribir). Las edge functions lo descifran con service role.

### 1.4 `WHATSAPP_APP_SECRET` global
La firma HMAC del webhook se valida con **un** App Secret global, pero el diseño es "una app de Meta por cliente". Con ≥2 clientes, la validación fallará para todos menos uno.
**Propuesta:** columna `app_secret` (cifrada) en `whatsapp_config`; el webhook prueba la firma contra los secrets de las configs activas (son pocas) o enruta por `phone_number_id` primero.

### 1.5 Varios
- **2FA/MFA**: no ofrecido. Para un ERP con nóminas y fiscalidad es esperable (Supabase lo soporta). → 🟠 P1
- **Sesiones**: sin control de expiración/dispositivos visibles para el usuario. → 🟡 P2
- **Rate limiting** en edge functions públicas (`public_api`, webhook): revisar cabeceras y límites. → 🟡 P2

---

## 2. Rendimiento de base de datos — 🟠 P1

| Aviso | Cantidad | Efecto | Remedio |
|---|---|---|---|
| `auth_rls_initplan` | 155 | `auth.uid()` se re-evalúa **por fila** en cada política → consultas lentas al crecer datos | Reescribir políticas con `(select auth.uid())` |
| `multiple_permissive_policies` | 105 | Varias políticas permisivas por tabla/acción se evalúan todas | Consolidar en 1 política por acción (`OR` interno) |
| `unindexed_foreign_keys` | 51 | Joins y cascadas lentas (p. ej. `chat_messages.account_id`, `invoice_lines`, `client_contacts.client_id`…) | *(✅ corregido: índices creados en la migración de auditoría)* |
| `unused_index` | 21 | Índices que no se usan (ruido y coste de escritura) | Revisar y eliminar tras 1 mes de métricas reales |

**Frontend:** todas las listas (facturas, clientes, asientos) cargan **el 100 % de las filas** y paginan en cliente. Correcto hasta ~2.000 registros; para producción, migrar las vistas principales a paginación por servidor (`range()` + `count`). → 🟠 P1 (facturas/asientos), 🟡 P2 (resto).

---

## 3. Modelo de datos y panel de administración — 🟠 P1

### 3.1 Cuentas (`accounts`) — creación de cuentas cliente
Hoy: `name, type, tax_id, phone, email, address, city, postal_code (+cifrados)`.

**Campos que faltan** para operar como SaaS serio:

| Campo | Motivo | Obligatorio |
|---|---|---|
| `legal_name` (razón social) | Facturar correctamente (nombre comercial ≠ fiscal) | Sí |
| `country` (ISO) | Fiscalidad e idioma | Sí (default ES) |
| `timezone` | Fichajes y recordatorios correctos | Sí (default Europe/Madrid) |
| `language` | Preparar i18n | Sí (default es) |
| `plan_id` + `billing_email` + `iban` | Cobrar el SaaS | Sí (plan) |
| `contact_name` / `contact_phone` | Persona de referencia | Sí |
| `province`, `website`, `logo_url` | Ficha completa y plantilla de factura | No |
| `onboarding_completed_at`, `suspended_at` | Ciclo de vida de la cuenta | No |

**Propuesta:** migración + rediseño del formulario de alta en el panel Master con validación (NIF/CIF con checksum, email, teléfono) y del `CompanyTab` de Configuración.

### 3.2 Empleados (`employee_profiles`)
Hoy: nombre, DNI, teléfono, nacimiento, dirección, departamento, puesto, `start_date`, NSS.

**Estructura profesional propuesta:**

| Campo nuevo | Tipo | Nota |
|---|---|---|
| `end_date` | date | Baja |
| `status` | ACTIVE / ON_LEAVE / TERMINATED | Derivado pero explícito |
| `contract_type` | INDEFINIDO / TEMPORAL / PRACTICAS / BECA / AUTONOMO | select |
| `weekly_hours` | numeric | Jornada contratada |
| `schedule_template_id` | FK | Ver §4 |
| `manager_user_id` | FK | Responsable directo |
| `work_center_id` | FK a **nueva entidad `work_centers`** | Multi-sede |
| `department_id` | FK a **nueva entidad `departments`** | Hoy es texto libre → inconsistencias |
| `corporate_email`, `iban_enc`, `salary_enc` | — | Cifrados (nómina) |
| `vacation_days_override` | int | Excepción al valor de empresa |
| `notes` | text | Observaciones RRHH |

Normalizar `department` (texto libre) a tabla es lo más importante: hoy dos empleados pueden estar en "Ventas" y "ventas".

### 3.3 Horarios — sistema de plantillas
Hoy existe **un único horario para toda la empresa** (`account_settings.work_start_time/work_end_time/work_days`). Insuficiente para cualquier pyme con turnos.

**Propuesta:**
```
schedule_templates (id, account_id, name, kind)        -- "Jornada partida", "Turno mañana"…
schedule_template_slots (template_id, weekday, start_time, end_time)  -- permite partida (2 tramos)
employee_profiles.schedule_template_id                  -- herencia
employee_schedule_overrides (user_id, weekday, start, end, valid_from, valid_to)  -- personalización
company_holidays (account_id, date, name, work_center_id null)        -- festivos
```
El cálculo de horas esperadas (dashboard empleado, balance mensual) pasa a usar la plantilla del empleado en vez del horario global. Los **festivos** hoy no existen → los balances de horas salen mal en festivos.

### 3.4 Facturación
- **`due_date` no existe.** "Vencida" = `SENT` con >30 días desde emisión (heurística en dashboard y motor). Añadir `due_date` (default configurable: 30 días), estado calculado real y aviso previo al vencimiento. → 🟠 P1
- **Forma de pago** en factura (transferencia + IBAN, domiciliación, tarjeta): campo y visualización en plantilla PDF. → 🟠 P1
- **Rectificativas**: el tipo no contempla factura rectificativa (obligatoria legalmente cuando hay errores; con VERI*FACTU es imprescindible porque la original es inmutable). → 🟠 P1
- Series de numeración por año ya existen ✓. Presupuesto→factura ✓. Recurrentes ✓.

---

## 4. Módulos — revisión funcional

### Contabilidad — 🟡 P2 (base ya sólida tras el motor nuevo)
- Falta **asiento de liquidación periódica** (IVA 303: 477/472 → 4750/4700; retenciones 111/130). Ya identificado como "Fase C".
- **Cierre de ejercicio** (asiento de regularización 129) inexistente.
- **Export para gestorías** (A3, Contaplus, CSV normalizado): para el mercado pyme español es un diferenciador clave. → 🔵 P1 de producto

### Chat / WhatsApp — 🟡 P2
- Falta gestión de la **ventana de 24 h** (indicador visual + plantillas aprobadas para reabrir). Sin esto, los agentes verán fallos de envío sin entender por qué.
- Mensajes `FAILED` ahora guardan `error_detail` ✓ — mostrarlo en la burbuja con tooltip y botón "Reintentar".
- Adjuntos (imágenes/documentos) no soportados aún.

### Asistencia — 🟡 P2
- Depende del horario único (ver §3.3). Sin festivos, los balances mensuales penalizan indebidamente.
- Falta **informe mensual firmable** (registro horario obligatorio por ley en España: exportable por empleado/mes). → 🟠 P1 (requisito legal del cliente)

### Tareas — 🟡 P2
- Tareas sin fecha límite ya soportadas ✓. Falta ordenación/agrupación por prioridad visible y vista "Mis tareas" como filtro por defecto para empleados.

### Panel Master — 🟠 P1
- El alta de cuentas no recoge los campos de §3.1 ni asigna plan.
- No hay **impersonación auditada** ("ver como cliente") — clave para soporte.
- No hay métricas de facturación del SaaS (MRR, churn) — cuando haya planes de pago.

---

## 5. UX / UI — consistencia — 🟠 P1 / 🟡 P2

Lo bueno: design system con tokens HSL coherente, tipografía única (Inter), pestañas y menú modernizados, hub de Configuración, patrón `FormSection` unificado en formularios principales.

Pendiente:

| Problema | Evidencia | Propuesta | Nivel |
|---|---|---|---|
| Estados de carga inconsistentes | Solo 2 usos de `Skeleton`; mezcla de spinners | Componente `<PageSkeleton>`/`<TableSkeleton>` y patrón único | 🟠 |
| Estados vacíos desiguales | Algunos con CTA (Clientes ✓), otros texto plano | Componente `<EmptyState icon title desc action>` global | 🟠 |
| Formateo de moneda duplicado | 14 ficheros con `toLocaleString("es-ES"...)` | `src/lib/format.ts` (`fmtEUR`, `fmtDate`, `fmtPct`) único | 🟠 |
| Capitalización de títulos mixta | "Nueva Factura" vs "Nueva factura" | Norma: sentence case en todo | 🟡 |
| Confirmaciones destructivas desiguales | Algunos deletes con AlertDialog, otros directos | AlertDialog SIEMPRE en acciones irreversibles | 🟠 |
| `ErrorBoundary` solo en layouts | 3 usos | Suficiente como red global; añadir fallback con botón "Recargar" | 🟡 |
| Accesibilidad | Iconos-botón sin `aria-label` en varias tablas; foco visible OK en general | Pasada de aria-labels + revisión de contraste en chips sobre azul del Login | 🟡 |
| Responsive | Patrón tabla→cards en HR ✓ pero no en Asientos/Conciliación | Extender patrón; Chat en móvil: lista y hilo en 2 pantallas | 🟡 |

---

## 6. Calidad de código — 🟡 P2

| Problema | Evidencia | Propuesta |
|---|---|---|
| Tipos de Supabase desactualizados | **136 `as any`** (las tablas nuevas —chat, categorías contables— no están en `types.ts`) | Regenerar `types.ts` (`supabase gen types` / MCP `generate_typescript_types`) y eliminar la mayoría de casts |
| Ficheros gigantes | `AppSettings.tsx` 1.099 líneas (contiene 6 sub-pantallas), `AppInvoices.tsx` 967, `BankReconciliationTab` 904 | Extraer cada Tab de Settings a `components/settings/`; separar tabla/filtros/detalle en Facturas |
| Lógica duplicada | Cálculo de totales de factura repetido en Create/Edit; `EUR()` duplicado | Hook `useInvoiceTotals()` + `lib/format.ts` |
| Tests | Vitest configurado pero cobertura mínima | Prioridad: motor contable (cálculos), reglas del bot, utilidades de formato |
| Bundle | `index.js` 2,27 MB (638 KB gzip); jsPDF/xlsx ya separados | `React.lazy` por ruta (Reports, Accounting, Master) → −40 % inicial |

---

## 7. Funcionalidades que faltan (visión Product Manager)

| Funcionalidad | Por qué la esperaría un cliente que paga | Nivel |
|---|---|---|
| **Registro horario exportable/firmable** | Obligación legal (RD 8/2019); las pymes lo piden a su software | 🟠 P1 |
| **`due_date` + recordatorios de cobro reales** | Gestión de tesorería seria | 🟠 P1 |
| **Export contable para gestorías (A3/Contaplus/CSV)** | El 90 % de pymes tiene gestoría; sin esto la contabilidad "no sale" del ERP | 🟠 P1 |
| **Facturas rectificativas** | Requisito legal, imprescindible con VERI*FACTU | 🟠 P1 |
| **Calendario de festivos** | Sin él, fichajes y balances mensuales son incorrectos | 🟠 P1 |
| **2FA** | Estándar B2B | 🟠 P1 |
| **Onboarding guiado de cuenta nueva** (wizard: empresa → equipo → plan contable → factura de prueba) | Reduce abandono en el alta | 🟡 P2 |
| **Plantillas WhatsApp (ventana 24 h)** | El chat pierde utilidad sin poder reabrir conversaciones | 🟡 P2 |
| **Portal del cliente final** (ver/pagar sus facturas) | Diferenciador fuerte | 🔵 P3 |
| **Multi-moneda / multi-idioma** | Solo si se sale de España | 🔵 P3 |
| **Planes y cobro del SaaS (Stripe)** | Monetización del propio XpertConsulting | 🔵 P3 |

---

## 8. Plan de ejecución propuesto

| Fase | Contenido | Esfuerzo |
|---|---|---|
| **F1 — Seguridad y rendimiento BD** | Revokes ✅, índices FK ✅, cifrado token Meta, app_secret por cuenta, leaked-password ON, consolidar políticas RLS (`(select auth.uid())` + 1 política/acción) | 1–2 días |
| **F2 — Modelo de datos** | Cuentas (§3.1), empleados (§3.2), departamentos/centros, `due_date` + rectificativas | 2–3 días |
| **F3 — Horarios y festivos** | Plantillas de horario, herencia+override, festivos, recálculo de balances, informe firmable | 2–3 días |
| **F4 — Consistencia UX** | `format.ts`, EmptyState/Skeleton globales, confirmaciones, aria, capitalización, responsive pendiente | 1–2 días |
| **F5 — Código** | Regenerar tipos (−136 `as any`), trocear AppSettings/AppInvoices, lazy-loading rutas, tests del motor contable | 2 días |
| **F6 — Producto** | Export gestoría, liquidación 303/111, plantillas WhatsApp, onboarding wizard | según prioridad comercial |

---

## 9. Aplicado ya durante esta auditoría ✅

1. **Migración `security_hardening_audit`**: revocado `EXECUTE` público de 15 funciones internas del motor contable y triggers (cierra la manipulación entre cuentas).
2. **Índices en todas las FKs sin indexar** (51 detectadas) — generados automáticamente.

El resto queda pendiente de tu aprobación por fases.
