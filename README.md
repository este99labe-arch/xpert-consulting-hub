# XpertConsulting ERP

Sistema ERP multi-tenant para gestión empresarial: facturación, contabilidad, RRHH, inventario y más.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Auth, Database, Edge Functions, Storage
- **State:** TanStack React Query
- **Charts:** Recharts

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | KPIs, charts, recent activity |
| **Clients** | Business client management |
| **Invoices** | Income/expense invoices, recurring templates, email sending |
| **Accounting** | Chart of accounts, journal entries, ledger, P&L |
| **HR** | Employee profiles, leave requests, documents |
| **Attendance** | Check-in/out, team attendance view |
| **Inventory** | Products, stock movements, purchase orders, low-stock alerts |
| **Reports** | Business analytics and data export |
| **Settings** | Account config, API keys, webhooks, audit log |

## Roles

| Role | Access |
|------|--------|
| `MASTER_ADMIN` | Full access + Master panel for multi-tenant management |
| `MANAGER` | Full access to assigned account |
| `EMPLOYEE` | Limited access (own attendance, profile, leave requests) |

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create_client_account` | Provisions new tenant accounts |
| `admin_reset_password` | Admin-initiated password reset |
| `send_welcome_email` | Welcome email to new users |
| `send_invoice_email` | Email invoice PDF to clients |
| `generate_invoice_pdf` | PDF generation |
| `send_payment_reminders` | Automated payment reminder emails |
| `process_recurring_invoices` | Creates invoices from recurring templates |
| `generate_notifications` | System notification generation |
| `public_api` | REST API for external integrations |
| `manage_api_keys` | API key CRUD operations |
| `dispatch_webhooks` | Webhook event delivery |

## Public API

External systems can access data via the Public API using API keys. See [docs/api-reference.md](docs/api-reference.md) for full documentation.

## Local Development

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

## Environment Variables

Configured automatically by Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Testing

```bash
npm test
```

## License

Private — All rights reserved.
