
# Plan de Desarrollo — XpertConsulting ERP

## Estado Actual (Resumen)

ERP multi-tenant con 8 módulos funcionales: Dashboard, Clientes, Facturación, Contabilidad, RRHH, Asistencia, Inventario y Configuración. Sistema de roles (MASTER_ADMIN, MANAGER, EMPLOYEE), RLS en todas las tablas, activación modular por cuenta.

---

## Próxima funcionalidad: XpertRed

### Descripción
Red empresarial interna B2B con matching tipo Tinder, chat post-match, sistema de reputación verificada y panel de administración. Módulo activable por cuenta.

### 1. Base de datos

#### Nuevas tablas:
- **`xred_profiles`** — Perfil de empresa en la red: `account_id` (FK→accounts, PK), `description`, `services_offered` (text[]), `services_needed` (text[]), `cnae_code`, `province`, `employee_count`, `is_visible` (bool), `reputation_score` (decimal), `created_at`, `updated_at`
- **`xred_interactions`** — Interacciones like/skip/block: `id`, `account_id_from` (FK), `account_id_to` (FK), `type` (like/skip/block), `is_match` (bool), `created_at`. UNIQUE (from, to).
- **`xred_messages`** — Chat post-match: `id`, `interaction_id` (FK→xred_interactions donde is_match=true), `sender_account_id`, `content`, `created_at`, `is_read`
- **`xred_reviews`** — Valoraciones: `id`, `interaction_id` (FK), `reviewer_account_id`, `reviewed_account_id`, `invoice_id` (FK→invoices, opcional), `punctuality` (1-5), `quality` (1-5), `communication` (1-5), `fair_price` (1-5), `comment`, `is_flagged`, `created_at`

#### Módulo:
- INSERT en `service_modules` con code='XPERTRED'

#### Realtime:
- Habilitar realtime en `xred_messages`

### 2. Frontend

#### Página `/app/xpertred` con pestañas:
1. **Descubrir** — Deck tipo Tinder con tarjetas + score compatibilidad + like/skip
2. **Matches / Chat** — Lista de matches con chat en tiempo real (Supabase Realtime)
3. **Mi Red** — Grid de conexiones con filtros sector/zona
4. **Mi Perfil** — Edición perfil + panel reputación con barras
5. **Admin** (MASTER_ADMIN) — KPIs, moderación valoraciones

#### Sidebar:
- Nuevo ítem "XpertRed" condicionado al módulo activado

### 3. Matching
- Score: CNAE 30%, servicios 25%, zona 15%, reputación 15%, tamaño 10%, historial 5%
- Match mutuo: función DB → is_match = true cuando like bidireccional
- Excluir propia cuenta y cuentas ya interactuadas

### 4. Acceso
- Solo MANAGER gestiona perfil y hace swipes
- Solo cuentas activas con módulo XPERTRED habilitado

### 5. Orden de ejecución
1. Migración DB (tablas + RLS + realtime + módulo)
2. Componentes UI (5 pestañas)
3. Integración en rutas y sidebar
4. Chat realtime + matching
