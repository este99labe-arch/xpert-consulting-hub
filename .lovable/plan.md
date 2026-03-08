

# Phase 5 — Production Readiness

Phase 5 focuses on tests, monitoring, onboarding, and documentation. Some items (5.3 domain/SSL, 5.4 backups) are infrastructure-level and handled by Lovable Cloud, so we'll focus on what we can implement in code.

---

## 5.1 — Unit & Integration Tests

Add meaningful tests for core business logic and utilities:

- **`src/lib/auditLog.test.ts`**: Test `logAudit` calls supabase correctly, handles errors silently.
- **`src/lib/webhooks.test.ts`**: Test `dispatchWebhook` constructs correct URL/payload, handles missing session.
- **`src/lib/utils.test.ts`**: Test `cn()` utility.
- **`src/components/inventory/AlertsTab.test.tsx`**: Component test — renders low stock products, empty state.
- **`src/components/invoices/RecurringInvoicesTab.test.tsx`**: Component test — renders empty state, form opens.
- **`src/contexts/AuthContext.test.tsx`**: Test role mapping logic.

Mock `supabase` client in all tests. Use `@testing-library/react` (already in setup).

---

## 5.2 — Error Boundary + Structured Logging

- **`src/components/shared/ErrorBoundary.tsx`**: React error boundary that catches rendering errors, shows a friendly fallback UI with "Reintentar" button, and logs the error.
- **`src/lib/logger.ts`**: Structured logging utility (`logger.info/warn/error`) that in production could send to an external service. For now, wraps `console` with structured JSON format including timestamp, level, context.
- Wrap `<Outlet />` in `ClientLayout` and `MasterLayout` with `<ErrorBoundary>`.

---

## 5.3 — Onboarding Tour for New Users

- **`src/components/shared/OnboardingTour.tsx`**: A step-by-step tooltip overlay that highlights key UI areas (sidebar, dashboard KPIs, invoices, settings). Uses local state + `localStorage` flag (`onboarding_completed`) to show only once.
- Integrate into `ClientLayout` — renders after first login when flag is absent.
- 5-6 steps: Welcome, Sidebar navigation, Dashboard, Create invoice, Settings.
- Pure CSS/React implementation (no external library needed) — positioned tooltips with backdrop overlay.

---

## 5.4 — Documentation & README

- **`README.md`**: Complete rewrite with project overview, tech stack, architecture, module list, setup instructions, environment variables, edge functions list, API documentation summary.
- **`docs/api-reference.md`**: Public API documentation — endpoints, authentication (API key), example requests/responses for `/clients`, `/invoices`, `/products`.

---

## 5.5 — Health Check Indicator

- **`src/components/shared/HealthCheck.tsx`**: Small status indicator in the sidebar footer showing backend connectivity status (green/red dot). Pings a lightweight query on mount.

---

## Implementation Order

1. **5.2** Error Boundary + Logger (stability first)
2. **5.1** Tests (quality assurance)
3. **5.3** Onboarding Tour (UX)
4. **5.5** Health Check (visibility)
5. **5.4** Documentation (maintenance)

## Files to Create/Modify

**Create:**
- `src/components/shared/ErrorBoundary.tsx`
- `src/lib/logger.ts`
- `src/components/shared/OnboardingTour.tsx`
- `src/components/shared/HealthCheck.tsx`
- `src/lib/auditLog.test.ts`
- `src/lib/webhooks.test.ts`
- `src/lib/utils.test.ts`
- `docs/api-reference.md`

**Modify:**
- `src/layouts/ClientLayout.tsx` — add ErrorBoundary + OnboardingTour
- `src/layouts/MasterLayout.tsx` — add ErrorBoundary
- `README.md` — full rewrite

No database changes needed.

